/**
 * Production Operations Types
 * Centralized type definitions for the operacoes module
 */

export interface ProductionItem {
  id: string;
  folha_obra_id: string;
  descricao: string;
  codigo?: string | null;
  quantidade?: number | null;
  concluido?: boolean;
  concluido_maq?: boolean | null;
  brindes?: boolean;
  prioridade?: boolean | null;
  complexidade?: string | null;
  created_at?: string | null;
  data_in?: string | null;
  folhas_obras?: {
    numero_fo?: string;
    nome_campanha?: string;
    numero_orc?: number;
    prioridade?: boolean | null;
  } | null;
  designer_items?: {
    paginacao?: boolean;
    path_trabalho?: string;
  } | null;
  logistica_entregas?:
    | { concluido?: boolean }[]
    | { concluido?: boolean }
    | null;
  // Runtime computed fields
  _operationsAllConcluded?: boolean;
  _hasOperations?: boolean;
}

export interface ProductionOperation {
  id: string;
  data_operacao: string;
  operador_id?: string | null;
  folha_obra_id: string;
  item_id: string;
  no_interno: string;
  Tipo_Op?: string;
  maquina?: string | null;
  material_id?: string | null;
  stock_consumido_id?: string | null;
  num_placas_print?: number | null;
  num_placas_corte?: number | null;
  QT_print?: number | null;
  observacoes?: string | null;
  notas?: string | null;
  notas_imp?: string | null;
  status?: string;
  concluido?: boolean;
  data_conclusao?: string | null;
  created_at?: string;
  updated_at?: string;
  N_Pal?: string | null;
  tem_corte?: boolean | null;
  source_impressao_id?: string | null;
  plano_nome?: string | null;
  cores?: string | null;
  qt_print_planned?: number | null;
  qt_corte_planned?: number | null;
  print_job_id?: string | null;
  cut_job_id?: string | null;
  is_source_record?: boolean;
  parent_operation_id?: string | null;
  batch_id?: string | null;
  batch_parent_id?: string | null;
  total_placas?: number | null;
  placas_neste_batch?: number | null;
}

export type SortKey =
  | "numero_fo"
  | "nome_campanha"
  | "descricao"
  | "quantidade"
  | "prioridade";

export interface AuditLogFilters {
  dateFrom?: Date;
  dateTo?: Date;
  operatorFilter: string;
  opTypeFilter: string;
  actionTypeFilter: string;
  changedByFilter: string;
}

export interface AuditLogStats {
  total: number;
  inserts: number;
  updates: number;
  deletes: number;
  suspicious: number;
  quantityIncreases: number;
  selfEdits: number;
  otherEdits: number;
}

export interface MaterialSelection {
  material?: string;
  carateristica?: string;
  cor?: string;
}

export interface PrintJobSummary {
  id: string;
  no_interno: string | null;
  plano_nome: string | null;
  planned: number;
  executed: number;
  remaining: number;
  progress: number;
}

export interface ItemDrawerProps {
  itemId: string;
  items: ProductionItem[];
  onClose: () => void;
  supabase: any;
  onMainRefresh: () => void;
}

export interface OperationsTableProps {
  operations: ProductionOperation[];
  type: "Impressao";
  itemId: string;
  folhaObraId: string;
  item: ProductionItem;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}

export interface CorteFromPrintTableProps {
  operations: ProductionOperation[];
  itemId: string;
  folhaObraId: string;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}
