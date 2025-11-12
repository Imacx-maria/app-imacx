export interface Material {
  id: string;
  material: string | null;
  cor: string | null;
  tipo: string | null;
  carateristica: string | null;
  fornecedor_id: string | null;
  qt_palete: number | null;
  valor_m2_custo: number | null;
  valor_placa: number | null;
  stock_minimo: number | null;
  stock_critico: number | null;
  referencia: string | null;
  stock_correct?: number | null;
  stock_correct_updated_at?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface Fornecedor {
  id: string;
  nome_forn: string;
}

export interface StockEntry {
  id: string;
  material_id: string;
  quantidade: number;
  quantidade_disponivel: number;
  vl_m2?: number | null;
  preco_unitario?: number | null;
  valor_total?: number | null;
  n_palet?: string | null;
  no_guia_forn?: string | null;
  notas?: string | null;
  data: string;
  fornecedor_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockEntryWithRelations extends StockEntry {
  materiais?: Material | null;
  fornecedores?: Fornecedor | null;
}

export interface CurrentStock {
  id: string;
  material: string | null;
  cor: string | null;
  tipo: string | null;
  carateristica: string | null;
  total_recebido: number;
  total_consumido: number;
  stock_atual: number;
  quantidade_disponivel: number;
  stock_minimo: number | null;
  stock_critico: number | null;
  referencia?: string | null;
  stock_correct?: number | null;
  stock_correct_updated_at?: string | null;
}

export interface Palete {
  id: string;
  no_palete: string;
  fornecedor_id: string | null;
  no_guia_forn: string | null;
  ref_cartao: string | null;
  qt_palete: number | null;
  data: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaleteWithRelations extends Palete {
  fornecedores?: {
    id: string;
    nome_forn: string;
  } | null;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  user_id: string;
}

export interface PaletesFilters {
  search?: string;
  referencia?: string;
  fornecedor?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Machine {
  id: string;
  nome?: string;
  nome_maquina?: string;
  tipo?: string;
}

export enum OperationType {
  CORTE = "corte",
  IMPRESSAO = "impressao",
  LAMINACAO = "laminacao",
  DOBRAGEM = "dobragem",
  COLAGEM = "colagem",
  EMBALAGEM = "embalagem",
}

export const OPERATION_TYPES = Object.values(OperationType);

export interface ProductionOperation {
  id: string;
  folha_obra_id?: string;
  item_id: string;
  operador_id?: string;
  data_operacao?: string;
  hora_inicio?: string;
  hora_fim?: string;
  tipo_operacao?: string;
  no_interno?: string;

  // Machine fields
  maquina_impressao_id?: string;
  maquina_corte_id?: string;
  maquina_id?: string;
  maquina?: string | null; // Machine ID used in operations

  // Material fields
  material_id?: string | null;
  stock_consumido_id?: string | null;
  quantidade_material_usado?: number;
  desperdicio?: number;

  // Operation type field (database uses Tipo_Op)
  Tipo_Op?: string; // "Impressao", "Impressao_Flexiveis", "Corte"

  // Quantity fields - execution
  num_placas_print?: number | null;
  num_placas_corte?: number | null;
  QT_print?: number | null; // Legacy field for print quantity

  // NEW WORKFLOW FIELDS - planned quantities and job grouping
  qt_print_planned?: number | null; // Planned print quantity from designer
  qt_corte_planned?: number | null; // Planned cut quantity
  print_job_id?: string | null; // Groups all print operation splits for same job
  cut_job_id?: string | null; // Groups all cut operation splits for same job
  is_source_record?: boolean; // TRUE for planning records, FALSE for execution
  parent_operation_id?: string | null; // References source operation for duplicates

  // Metadata fields
  plano_nome?: string | null; // Plan name (e.g., "Plano A", "Plano B")
  cores?: string | null; // Print colors (e.g., "4/4", "4/0")
  N_Pal?: string | null; // Palette number
  notas?: string | null; // Notes
  notas_imp?: string | null; // Print notes
  observacoes?: string; // Observations
  qualidade?: string;

  // Linking fields
  source_impressao_id?: string | null; // Links Corte operations to source Impressão operation
  tem_corte?: boolean | null; // Indicates if print operation requires cutting

  // Old batch fields (being phased out, replaced by print_job_id/cut_job_id)
  batch_id?: string | null;
  batch_parent_id?: string | null;
  total_placas?: number | null;
  placas_neste_batch?: number | null;

  // Status fields
  status?: "pendente" | "em_progresso" | "concluida" | "cancelada";
  concluido?: boolean;
  data_conclusao?: string | null;

  created_at: string;
  updated_at: string;
}

export interface ProductionOperationWithRelations extends ProductionOperation {
  items_base?: any | null;
  machines?: Machine | null;
  profiles?: Profile | null;
  concluido?: boolean;
  folhas_obras?: {
    numero_fo?: string;
    nome_campanha?: string;
    numero_orc?: number;
    prioridade?: boolean | null;
  } | null;
}

export interface ProductionOperationInput {
  folha_obra_id?: string;
  item_id: string;
  operador_id?: string;
  data_operacao?: string;
  hora_inicio?: string;
  hora_fim?: string;
  tipo_operacao?: string;
  no_interno?: string;
  maquina_impressao_id?: string;
  maquina_corte_id?: string;
  maquina_id?: string;
  material_id?: string;
  quantidade_material_usado?: number;
  desperdicio?: number;
  qualidade?: string;
  observacoes?: string;
  status?: "pendente" | "em_progresso" | "concluida" | "cancelada";
}

/**
 * Job (Folha de Obra) interface for the main producao page
 * Represents a production work order
 */
export interface Job {
  id: string;
  numero_fo: string;
  numero_orc?: string | null;
  nome_campanha: string;
  data_saida: string | null;
  prioridade: boolean | null;
  notas: string | null;
  concluido?: boolean | null;
  saiu?: boolean | null;
  fatura?: boolean | null;
  pendente?: boolean | null;
  created_at?: string | null;
  data_in?: string | null;
  cliente?: string | null;
  id_cliente?: string | null;
  customer_id?: number | null;
  data_concluido?: string | null;
  updated_at?: string | null;
  euro_tota?: number | null; // PHC value from existing Euro__tota column
}

/**
 * Item interface for production items within a job
 * Represents individual items that need to be produced
 */
export interface Item {
  id: string;
  folha_obra_id: string;
  descricao: string;
  codigo?: string | null;
  quantidade?: number | null;
  brindes?: boolean | null;
  concluido?: boolean | null;
  paginacao?: boolean | null;
}

/**
 * Loading state interface for tracking async operations
 * Used to show loading indicators for different data fetching operations
 */
export interface LoadingState {
  jobs: boolean;
  items: boolean;
  operacoes: boolean;
  clientes: boolean;
}

/**
 * Holiday interface for calendar integration
 * Represents holidays that affect production schedules
 */
export interface Holiday {
  id: string;
  holiday_date: string;
  description?: string;
}

/**
 * Sortable keys for the jobs table
 * Defines all columns that can be sorted
 */
export type SortableJobKey =
  | "created_at"
  | "numero_orc"
  | "numero_fo"
  | "cliente"
  | "nome_campanha"
  | "notas"
  | "prioridade"
  | "data_concluido"
  | "concluido"
  | "saiu"
  | "fatura"
  | "pendente"
  | "artwork"
  | "corte"
  | "total_value";

/**
 * PHC integration - Folha de Obra header from PHC system
 */
export interface PhcFoHeader {
  folha_obra_id: string;
  folha_obra_number?: string | null;
  orcamento_number?: string | null;
  nome_trabalho?: string | null;
  observacoes?: string | null;
  customer_id?: number | null;
  folha_obra_date?: string | null;
}

/**
 * Client option for dropdown/combobox
 */
export interface ClienteOption {
  value: string;
  label: string;
}

/**
 * Duplicate validation dialog state
 * Manages the state of duplicate ORC/FO number validation
 */
export interface DuplicateDialogState {
  isOpen: boolean;
  type: "orc" | "fo";
  value: string | number;
  existingJob?: Job;
  currentJobId: string;
  originalValue?: string | number | null;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * FO totals by tab
 * Tracks total number of FOs in each status category
 */
export interface FOTotals {
  em_curso: number;
  pendentes: number;
}

/**
 * Active tab types for the producao page
 */
export type ProducaoTab = "em_curso" | "concluidos" | "pendentes";

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";
