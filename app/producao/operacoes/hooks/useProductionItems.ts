/**
 * useProductionItems Hook
 * Handles fetching and filtering production items with proper database-level filtering
 */

import { useState, useCallback, useEffect } from "react";
import type { ProductionItem } from "../types";

interface UseProductionItemsOptions {
  supabase: any;
  foFilter: string;
  itemFilter: string;
}

interface UseProductionItemsReturn {
  items: ProductionItem[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export function useProductionItems({
  supabase,
  foFilter,
  itemFilter,
}: UseProductionItemsOptions): UseProductionItemsReturn {
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First, test basic access
      const { data: testData, error: testError } = await supabase
        .from("items_base")
        .select("id")
        .limit(1);

      if (testError) {
        throw new Error(`Database access error: ${testError.message}`);
      }

      if (!testData || testData.length === 0) {
        setItems([]);
        return;
      }

      // Fetch items with relations and apply database-level filters
      let query = supabase.from("items_base").select(`
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade,
          concluido,
          concluido_maq,
          brindes,
          prioridade,
          complexidade,
          created_at,
          folhas_obras!inner (
            Numero_do_,
            numero_orc,
            Trabalho,
            prioridade
          ),
          designer_items (
            paginacao,
            path_trabalho
          ),
          logistica_entregas (
            concluido
          )
        `);

      // Apply database-level filters
      query = query.or("concluido.is.null,concluido.eq.false");

      if (foFilter?.trim()) {
        query = query.ilike("folhas_obras.Numero_do_", `%${foFilter.trim()}%`);
      }
      if (itemFilter?.trim()) {
        query = query.ilike("descricao", `%${itemFilter.trim()}%`);
      }

      const { data: itemsData, error: itemsError } = await query;

      if (itemsError) {
        throw new Error(
          `Failed to fetch items with relations: ${itemsError.message}`
        );
      }

      if (!itemsData) {
        setItems([]);
        return;
      }

      // Transform the data
      const transformedItems = itemsData.map((item: any) => {
        const transformedItem = {
          ...item,
          folhas_obras: Array.isArray(item.folhas_obras)
            ? item.folhas_obras[0]
            : item.folhas_obras,
          designer_items: Array.isArray(item.designer_items)
            ? item.designer_items[0]
            : item.designer_items,
          logistica_entregas: Array.isArray(item.logistica_entregas)
            ? item.logistica_entregas
            : item.logistica_entregas,
        };

        // Map database columns to expected interface properties
        if (transformedItem.folhas_obras) {
          const foData: any = transformedItem.folhas_obras;
          const mappedFo: any = {
            numero_orc: foData.numero_orc,
            prioridade: foData.prioridade,
          };
          if (foData.Numero_do_ !== undefined) {
            mappedFo.numero_fo = String(foData.Numero_do_);
          }
          if (foData.Trabalho !== undefined) {
            mappedFo.nome_campanha = foData.Trabalho;
          }
          transformedItem.folhas_obras = mappedFo;
        }

        return transformedItem;
      });

      // Filter items that meet all conditions
      const filteredItems = transformedItems.filter((item: any) => {
        let hasLogisticaEntregasNotConcluida = false;

        if (item.logistica_entregas) {
          if (Array.isArray(item.logistica_entregas)) {
            hasLogisticaEntregasNotConcluida = item.logistica_entregas.some(
              (entrega: any) => entrega.concluido === false
            );
          } else {
            hasLogisticaEntregasNotConcluida =
              (item.logistica_entregas as any).concluido === false;
          }
        }

        const hasPaginacaoTrue = item.designer_items?.paginacao === true;
        const isNotBrinde = item.brindes !== true;
        const isNotOffset = item.complexidade !== "OFFSET";
        const isNotConcluido = item.concluido !== true;

        // Require both FO and ORC values
        const foData = item.folhas_obras as any;
        const hasFoValue =
          foData?.numero_fo &&
          foData?.numero_fo !== "0" &&
          foData?.numero_fo !== "0000";
        const hasOrcValue = foData?.numero_orc && foData?.numero_orc !== 0;

        return (
          hasLogisticaEntregasNotConcluida &&
          hasPaginacaoTrue &&
          isNotBrinde &&
          isNotOffset &&
          isNotConcluido &&
          hasFoValue &&
          hasOrcValue
        );
      });

      // Filter out items that have completed operations (Corte)
      const itemsWithoutCompleted = [];
      for (const item of filteredItems) {
        const { data: allOperations, error: allOpError } = await supabase
          .from("producao_operacoes")
          .select("concluido, Tipo_Op")
          .eq("item_id", item.id);

        const { data: corteOperations } = await supabase
          .from("producao_operacoes")
          .select("concluido")
          .eq("item_id", item.id)
          .in("Tipo_Op", ["Corte"]);

        if (!allOpError && allOperations) {
          const hasAnyCorte = corteOperations && corteOperations.length > 0;
          const allCorteConcluded =
            hasAnyCorte &&
            corteOperations.every((op: any) => op.concluido === true);

          const itemWithStatus = {
            ...item,
            _operationsAllConcluded: allCorteConcluded,
            _hasOperations: allOperations.length > 0,
          };

          if (!allCorteConcluded) {
            itemsWithoutCompleted.push(itemWithStatus);
          }
        } else {
          itemsWithoutCompleted.push({
            ...item,
            _operationsAllConcluded: false,
            _hasOperations: false,
          });
        }
      }

      setItems(itemsWithoutCompleted);
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.toString() || "Unknown error occurred";
      setError(`Failed to load production items: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [supabase, foFilter, itemFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, loading, error, fetchData };
}
