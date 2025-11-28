export interface ItemRow {
  id: string;
  descricao: string;
  codigo?: string | null;
  quantidade?: number | null;
  facturado?: boolean | null;
  // Job info
  folha_obra_id: string;
  numero_fo: string;
  numero_orc?: number | null;
  nome_campanha: string;
  cliente?: string | null;
  created_at?: string | null;
  pendente?: boolean | null;
  // Logistics info
  data_saida?: string | null;
  concluido?: boolean | null;
  // Calculated
  dias_trabalho?: number | null;
  dias_em_progresso?: boolean; // True if dias_trabalho is calculated to today (no data_saida)
}

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}
