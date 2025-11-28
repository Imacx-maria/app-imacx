import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, ProducaoTab } from "@/types/producao";

// Matches ExportProducaoRow from utils/exportProducaoToExcel.ts
interface ExportRow {
  numero_orc?: number | null;
  numero_fo?: string;
  cliente_nome?: string;
  quantidade?: number | null;
  nome_campanha?: string;
  descricao?: string;
  data_in?: string | null;
  data_saida?: string | null;
  data_concluido?: string | null;
  transportadora?: string;
  local_entrega?: string;
  local_recolha?: string;
  id_local_entrega?: string;
  id_local_recolha?: string;
  notas?: string | null;
  guia?: string | null;
  contacto_entrega?: string | null;
}

interface ClienteForExport {
  value: string;
  label: string;
  morada?: string;
  codigo_pos?: string;
}

/**
 * Hook for handling production data export
 * Extracts the complex data fetching logic from the main page component
 */
export function useProducaoExport(supabase: SupabaseClient) {
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Fetches transportadoras and creates a lookup map
   */
  const fetchTransportadorasMap = useCallback(async (): Promise<Map<string, string>> => {
    const { data, error } = await supabase
      .from("transportadora")
      .select("id, name");

    if (error) {
      console.error("Error fetching transportadoras:", error);
      return new Map();
    }

    return new Map((data || []).map((t: any) => [t.id, t.name]));
  }, [supabase]);

  /**
   * Fetches clientes with address information for export
   */
  const fetchClientesForExport = useCallback(async (): Promise<ClienteForExport[]> => {
    const { data, error } = await supabase
      .schema("phc")
      .from("cl")
      .select("customer_id, customer_name, address, postal_code");

    if (error) {
      console.error("Error fetching clientes:", error);
      return [];
    }

    return (data || []).map((c: any) => ({
      value: c.customer_id.toString(),
      label: c.customer_name,
      morada: c.address,
      codigo_pos: c.postal_code,
    }));
  }, [supabase]);

  /**
   * Transforms raw data into export rows
   */
  const transformToExportRows = useCallback(
    (
      logisticaData: any[],
      itemsMap: Map<string, any>,
      folhasMap: Map<string, any>,
      transportadorasMap: Map<string, string>
    ): ExportRow[] => {
      const exportRows: ExportRow[] = [];

      logisticaData.forEach((log: any) => {
        const item = itemsMap.get(log.item_id);
        if (!item) return;

        const folhaObra = folhasMap.get(item.folha_obra_id);
        if (!folhaObra) return;

        const transportadoraName = log.transportadora
          ? transportadorasMap.get(log.transportadora) || log.transportadora
          : "";

        exportRows.push({
          numero_orc: folhaObra.numero_orc || null,
          numero_fo: folhaObra.Numero_do_ ? String(folhaObra.Numero_do_) : "",
          cliente_nome: folhaObra.Nome || "",
          quantidade: item.quantidade || null,
          nome_campanha: folhaObra.Trabalho || "",
          descricao: item.descricao || "",
          data_in: folhaObra.data_in || folhaObra.created_at || null,
          data_saida: log.data_saida || null,
          data_concluido: log.data_concluido || null,
          transportadora: transportadoraName,
          local_entrega: log.local_entrega || "",
          local_recolha: log.local_recolha || "",
          id_local_entrega: log.id_local_entrega || "",
          id_local_recolha: log.id_local_recolha || "",
          notas: log.notas || "",
          guia: log.guia || "",
          contacto_entrega: log.contacto_entrega || "",
        });
      });

      return exportRows;
    },
    []
  );

  /**
   * Fetches export data for a specific tab (em_curso or pendentes)
   */
  const fetchExportDataForTab = useCallback(
    async (
      isPendentes: boolean,
      transportadorasMap: Map<string, string>
    ): Promise<ExportRow[]> => {
      try {
        // Fetch jobs based on pendente status
        const { data: jobsData, error: jobsError } = await supabase
          .from("folhas_obras")
          .select(
            "id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome, data_in, created_at"
          )
          .eq("pendente", isPendentes)
          .eq("concluido", false)
          .order("Numero_do_", { ascending: false });

        if (jobsError || !jobsData || jobsData.length === 0) {
          return [];
        }

        const jobIds = jobsData.map((j: any) => j.id);

        // Fetch items for these jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from("items_base")
          .select("id, folha_obra_id, descricao, quantidade")
          .in("folha_obra_id", jobIds);

        if (itemsError || !itemsData || itemsData.length === 0) {
          return [];
        }

        const itemIds = itemsData.map((i: any) => i.id);

        // Fetch logistics for items (only incomplete for em_curso, all for pendentes)
        let logisticaQuery = supabase
          .from("logistica_entregas")
          .select(
            "item_id, data_saida, data_concluido, transportadora, local_entrega, local_recolha, id_local_entrega, id_local_recolha, notas, guia, contacto_entrega"
          )
          .in("item_id", itemIds);

        if (!isPendentes) {
          logisticaQuery = logisticaQuery.eq("concluido", false);
        }

        const { data: logisticaData, error: logisticaError } = await logisticaQuery;

        if (logisticaError || !logisticaData || logisticaData.length === 0) {
          return [];
        }

        // Create lookup maps
        const itemsMap = new Map(itemsData.map((i: any) => [i.id, i]));
        const folhasMap = new Map(jobsData.map((f: any) => [f.id, f]));

        return transformToExportRows(logisticaData, itemsMap, folhasMap, transportadorasMap);
      } catch (error) {
        console.error(`Error fetching ${isPendentes ? "pendentes" : "em_curso"} data:`, error);
        return [];
      }
    },
    [supabase, transformToExportRows]
  );

  /**
   * Main export function - handles all data fetching and triggers the export
   */
  const exportData = useCallback(
    async (sortedJobs: Job[], activeTab: ProducaoTab) => {
      if (sortedJobs.length === 0) {
        alert("Não há dados para exportar.");
        return;
      }

      const jobIds = sortedJobs
        .map((job) => job.id)
        .filter((id) => !id.startsWith("temp-"));

      if (jobIds.length === 0) {
        alert("Não há trabalhos válidos para exportar.");
        return;
      }

      setIsExporting(true);

      try {
        console.log(`Exporting data for ${jobIds.length} jobs...`);

        // Fetch reference data
        const [transportadorasMap, clientesForExport] = await Promise.all([
          fetchTransportadorasMap(),
          fetchClientesForExport(),
        ]);

        // STEP 1: Fetch items for current jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from("items_base")
          .select("id, folha_obra_id, descricao, quantidade")
          .in("folha_obra_id", jobIds);

        if (itemsError) {
          console.error("Error fetching items:", itemsError);
          alert("Erro ao buscar itens.");
          return;
        }

        if (!itemsData || itemsData.length === 0) {
          alert("Não há itens para exportar.");
          return;
        }

        const itemIds = itemsData.map((i: any) => i.id);

        // STEP 2: Fetch logistics for these items (only incomplete)
        const { data: logisticaData, error: logisticaError } = await supabase
          .from("logistica_entregas")
          .select(
            "item_id, data_concluido, data_saida, transportadora, local_entrega, local_recolha, id_local_entrega, id_local_recolha, concluido, notas, guia, contacto_entrega"
          )
          .in("item_id", itemIds)
          .eq("concluido", false);

        if (logisticaError) {
          console.error("Error fetching logistics:", logisticaError);
          alert("Erro ao buscar dados de logística.");
          return;
        }

        if (!logisticaData || logisticaData.length === 0) {
          alert("Não há itens com logística incompleta para exportar.");
          return;
        }

        // STEP 3: Fetch folhas_obras
        const { data: folhasData, error: folhasError } = await supabase
          .from("folhas_obras")
          .select(
            "id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome, data_in, created_at"
          )
          .in("id", jobIds);

        if (folhasError) {
          console.error("Error fetching folhas obras:", folhasError);
          alert("Erro ao buscar folhas de obra.");
          return;
        }

        // Create lookup maps
        const itemsMap = new Map(itemsData.map((i: any) => [i.id, i]));
        const folhasMap = new Map(folhasData?.map((f: any) => [f.id, f]) || []);

        // Transform current tab data
        const currentExportRows = transformToExportRows(
          logisticaData,
          itemsMap,
          folhasMap,
          transportadorasMap
        );

        // Determine which dataset to use for each sheet
        let emCursoRows: ExportRow[];
        let pendentesRows: ExportRow[];

        if (activeTab === "pendentes") {
          // Current data is PENDENTES, need to fetch EM CURSO
          pendentesRows = currentExportRows;
          emCursoRows = await fetchExportDataForTab(false, transportadorasMap);
        } else {
          // Current data is EM CURSO, need to fetch PENDENTES
          emCursoRows = currentExportRows;
          pendentesRows = await fetchExportDataForTab(true, transportadorasMap);
        }

        // PERFORMANCE: Lazy load ExcelJS (500KB) only when user clicks export
        const { exportProducaoToExcel } = await import("@/utils/exportProducaoToExcel");

        exportProducaoToExcel({
          filteredRecords: emCursoRows,
          pendentesRecords: pendentesRows,
          activeTab,
          clientes: clientesForExport,
        });
      } catch (error) {
        console.error("Error during export:", error);
        alert("Erro ao exportar dados.");
      } finally {
        setIsExporting(false);
      }
    },
    [
      supabase,
      fetchTransportadorasMap,
      fetchClientesForExport,
      fetchExportDataForTab,
      transformToExportRows,
    ]
  );

  return {
    exportData,
    isExporting,
  };
}
