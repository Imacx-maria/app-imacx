import { useState, useCallback, useEffect } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { ItemRow } from "../types";

interface UseFaturacaoDataProps {
  filters: {
    fo: string;
    orc: string;
    campanha: string;
    cliente: string;
  };
}

export function useFaturacaoData({ filters }: UseFaturacaoDataProps) {
  const supabase = createBrowserClient();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      // Get ALL items with their job information and logistics data
      // Filtering by tab happens on client-side in the page component
      let query = supabase.from("items_base").select(`
          id,
          descricao,
          codigo,
          quantidade,
          facturado,
          folha_obra_id,
          folhas_obras!inner (
            numero_fo:Numero_do_,
            numero_orc,
            nome_campanha:Trabalho,
            cliente:Nome,
            created_at,
            pendente
          ),
          logistica_entregas (
            data_saida,
            concluido
          )
        `);

      // Apply database-level filters for ALL filter inputs
      // These filters work across ALL tabs, not just current tab
      if (filters.fo?.trim()) {
        query = query.ilike(
          "folhas_obras.Numero_do_",
          `%${filters.fo.trim()}%`,
        );
      }
      if (filters.orc?.trim()) {
        const orcNumber = parseInt(filters.orc.trim());
        if (!isNaN(orcNumber)) {
          query = query.eq("folhas_obras.numero_orc", orcNumber);
        }
      }
      if (filters.campanha?.trim()) {
        query = query.ilike(
          "folhas_obras.Trabalho",
          `%${filters.campanha.trim()}%`,
        );
      }
      if (filters.cliente?.trim()) {
        query = query.ilike("folhas_obras.Nome", `%${filters.cliente.trim()}%`);
      }

      // NOTE: We fetch from BOTH facturados AND por_facturar (both tabs)
      // Tab filtering happens client-side in page.tsx
      // This allows us to show accurate counts per tab

      const { data: itemsData, error: itemsError } = await query;

      if (itemsError) throw itemsError;

      // Transform data to flat structure
      const transformedItems: ItemRow[] = (itemsData || []).map((item: any) => {
        const job = item.folhas_obras;
        const logistics = item.logistica_entregas?.[0]; // Get first logistics entry

        let dias_trabalho: number | null = null;
        let dias_em_progresso = false;

        if (job.created_at) {
          if (logistics?.data_saida) {
            // Has data_saida: calculate from created_at to data_saida
            dias_trabalho = Math.ceil(
              (new Date(logistics.data_saida).getTime() -
                new Date(job.created_at).getTime()) /
                (1000 * 60 * 60 * 24),
            );
          } else {
            // No data_saida: calculate from created_at to today (in orange)
            const today = new Date();
            dias_trabalho = Math.ceil(
              (today.getTime() - new Date(job.created_at).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            dias_em_progresso = true;
          }
        }

        return {
          id: item.id,
          descricao: item.descricao,
          codigo: item.codigo,
          quantidade: item.quantidade,
          facturado: item.facturado,
          folha_obra_id: item.folha_obra_id,
          numero_fo: job.numero_fo,
          numero_orc: job.numero_orc,
          nome_campanha: job.nome_campanha,
          cliente: job.cliente,
          created_at: job.created_at,
          pendente: job.pendente,
          // Logistics data
          data_saida: logistics?.data_saida || null,
          concluido: logistics?.concluido || false,
          // Days calculation
          dias_trabalho,
          dias_em_progresso,
        };
      });

      setItems(transformedItems);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters]);

  // Initial load
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle refresh with ETL sync + auto-mark facturado
  const refresh = useCallback(async () => {
    if (isRefreshing) {
      console.log("⚠️ Refresh already in progress, ignoring click");
      return;
    }

    setIsRefreshing(true);
    try {
      console.log("🔄 [Faturacao] Starting refresh...");

      // Step 1: Run ETL sync (same as "Atualizar PHC" button)
      console.log("📊 [Faturacao] Step 1: Running ETL sync...");
      const etlResp = await fetch("/api/etl/incremental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fast_all" }),
      });

      if (!etlResp.ok) {
        const details = await etlResp.json().catch(() => ({}));
        const message =
          (details && (details.message || details.error)) ||
          "Erro ao correr a atualização rápida do PHC.";
        console.error("❌ [Faturacao] ETL sync failed:", message);
        throw new Error(message);
      }
      console.log("✅ [Faturacao] Step 1 complete: ETL sync done");

      // Step 2: Check for converted quotes and mark items as facturado
      console.log("🔄 [Faturacao] Step 2: Checking for converted quotes...");
      const autoDismissResp = await fetch(
        "/api/gestao/departamentos/auto-dismiss-converted",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (autoDismissResp.ok) {
        const autoDismissData = await autoDismissResp.json();
        console.log("✅ [Faturacao] Step 2 complete:", autoDismissData);
        if (autoDismissData.itemsMarked > 0) {
          console.log(
            `✅ Marked ${autoDismissData.itemsMarked} item(s) as facturado from ${autoDismissData.quoteNumbers.length} converted quote(s)`,
            autoDismissData.jobsUpdated,
          );
        } else {
          console.log("ℹ️ No new items to mark as facturado");
        }
      } else {
        console.warn("⚠️ [Faturacao] Auto-mark check failed (non-critical)");
      }

      // Step 3: Refresh items to show updated data
      console.log("🔄 [Faturacao] Step 3: Refreshing table...");
      await fetchItems();
      console.log("✅ [Faturacao] All steps complete!");
    } catch (error) {
      console.error("❌ [Faturacao] Error during refresh:", error);
      alert(
        "Falha ao atualizar PHC. Verifica a configuração do ETL e tenta novamente.",
      );
      // Still try to fetch items even if ETL/auto-mark failed
      await fetchItems();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchItems, isRefreshing]);

  // Handle individual item facturado toggle
  const toggleFacturado = useCallback(
    async (itemId: string, newValue: boolean) => {
      try {
        const { error } = await supabase
          .from("items_base")
          .update({ facturado: newValue })
          .eq("id", itemId);

        if (error) throw error;

        // Refresh items to update table
        await fetchItems();
      } catch (error) {
        console.error("Error updating item facturado:", error);
        alert(`Erro ao atualizar: ${error}`);
      }
    },
    [supabase, fetchItems],
  );

  return {
    items,
    loading,
    isRefreshing,
    refresh,
    toggleFacturado,
  };
}
