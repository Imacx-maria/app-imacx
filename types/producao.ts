export interface Material {
  id: string
  material: string | null
  cor: string | null
  tipo: string | null
  carateristica: string | null
  fornecedor_id: string | null
  qt_palete: number | null
  valor_m2_custo: number | null
  valor_placa: number | null
  stock_minimo: number | null
  stock_critico: number | null
  referencia: string | null
  stock_correct?: number | null
  stock_correct_updated_at?: string | null
}

export interface Fornecedor {
  id: string
  nome_forn: string
}

export interface StockEntry {
  id: string
  material_id: string
  quantidade: number
  quantidade_disponivel: number
  vl_m2?: number | null
  preco_unitario?: number | null
  valor_total?: number | null
  n_palet?: string | null
  no_guia_forn?: string | null
  notas?: string | null
  data: string
  fornecedor_id?: string | null
  created_at: string
  updated_at: string
}

export interface StockEntryWithRelations extends StockEntry {
  materiais?: Material | null
  fornecedores?: Fornecedor | null
}

export interface CurrentStock {
  id: string
  material: string | null
  cor: string | null
  tipo: string | null
  carateristica: string | null
  total_recebido: number
  total_consumido: number
  stock_atual: number
  quantidade_disponivel: number
  stock_minimo: number | null
  stock_critico: number | null
  referencia?: string | null
  stock_correct?: number | null
  stock_correct_updated_at?: string | null
}

export interface Palete {
  id: string
  no_palete: string
  fornecedor_id: string | null
  no_guia_forn: string | null
  ref_cartao: string | null
  qt_palete: number | null
  data: string
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface PaleteWithRelations extends Palete {
  fornecedores?: {
    id: string
    nome_forn: string
  } | null
  profiles?: {
    id: string
    first_name: string
    last_name: string
  } | null
}

export interface Profile {
  id: string
  first_name: string
  last_name: string
  user_id: string
}

export interface PaletesFilters {
  search?: string
  referencia?: string
  fornecedor?: string
  author?: string
  dateFrom?: string
  dateTo?: string
}

export interface Machine {
  id: string
  nome?: string
  nome_maquina?: string
  tipo?: string
}

export enum OperationType {
  CORTE = 'corte',
  IMPRESSAO = 'impressao',
  LAMINACAO = 'laminacao',
  DOBRAGEM = 'dobragem',
  COLAGEM = 'colagem',
  EMBALAGEM = 'embalagem',
}

export const OPERATION_TYPES = Object.values(OperationType)

export interface ProductionOperation {
  id: string
  folha_obra_id?: string
  item_id: string
  operador_id?: string
  data_operacao?: string
  hora_inicio?: string
  hora_fim?: string
  tipo_operacao?: string
  no_interno?: string
  maquina_impressao_id?: string
  maquina_corte_id?: string
  maquina_id?: string
  material_id?: string
  quantidade_material_usado?: number
  desperdicio?: number
  qualidade?: string
  observacoes?: string
  status?: 'pendente' | 'em_progresso' | 'concluida' | 'cancelada'
  source_impressao_id?: string | null  // Links Corte operations to source Impressão operation
  created_at: string
  updated_at: string
}

export interface ProductionOperationWithRelations extends ProductionOperation {
  items_base?: any | null
  machines?: Machine | null
  profiles?: Profile | null
  concluido?: boolean
  folhas_obras?: {
    numero_fo?: string
    nome_campanha?: string
    numero_orc?: number
    prioridade?: boolean | null
  } | null
}

export interface ProductionOperationInput {
  folha_obra_id?: string
  item_id: string
  operador_id?: string
  data_operacao?: string
  hora_inicio?: string
  hora_fim?: string
  tipo_operacao?: string
  no_interno?: string
  maquina_impressao_id?: string
  maquina_corte_id?: string
  maquina_id?: string
  material_id?: string
  quantidade_material_usado?: number
  desperdicio?: number
  qualidade?: string
  observacoes?: string
  status?: 'pendente' | 'em_progresso' | 'concluida' | 'cancelada'
}

/**
 * Job (Folha de Obra) interface for the main producao page
 * Represents a production work order
 */
export interface Job {
  id: string
  numero_fo: string
  numero_orc?: string | null
  nome_campanha: string
  data_saida: string | null
  prioridade: boolean | null
  notas: string | null
  concluido?: boolean | null
  saiu?: boolean | null
  fatura?: boolean | null
  pendente?: boolean | null
  created_at?: string | null
  data_in?: string | null
  cliente?: string | null
  id_cliente?: string | null
  customer_id?: number | null
  data_concluido?: string | null
  updated_at?: string | null
}

/**
 * Item interface for production items within a job
 * Represents individual items that need to be produced
 */
export interface Item {
  id: string
  folha_obra_id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  brindes?: boolean | null
  concluido?: boolean | null
  paginacao?: boolean | null
}

/**
 * Loading state interface for tracking async operations
 * Used to show loading indicators for different data fetching operations
 */
export interface LoadingState {
  jobs: boolean
  items: boolean
  operacoes: boolean
  clientes: boolean
}

/**
 * Holiday interface for calendar integration
 * Represents holidays that affect production schedules
 */
export interface Holiday {
  id: string
  holiday_date: string
  description?: string
}

/**
 * Sortable keys for the jobs table
 * Defines all columns that can be sorted
 */
export type SortableJobKey =
  | 'created_at'
  | 'numero_orc'
  | 'numero_fo'
  | 'cliente'
  | 'nome_campanha'
  | 'notas'
  | 'prioridade'
  | 'data_concluido'
  | 'concluido'
  | 'saiu'
  | 'fatura'
  | 'pendente'
  | 'artwork'
  | 'corte'
  | 'total_value'

/**
 * PHC integration - Folha de Obra header from PHC system
 */
export interface PhcFoHeader {
  folha_obra_id: string
  folha_obra_number?: string | null
  orcamento_number?: string | null
  nome_trabalho?: string | null
  observacoes?: string | null
  customer_id?: number | null
  folha_obra_date?: string | null
}

/**
 * Client option for dropdown/combobox
 */
export interface ClienteOption {
  value: string
  label: string
}

/**
 * Duplicate validation dialog state
 * Manages the state of duplicate ORC/FO number validation
 */
export interface DuplicateDialogState {
  isOpen: boolean
  type: 'orc' | 'fo'
  value: string | number
  existingJob?: Job
  currentJobId: string
  originalValue?: string | number | null
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * FO totals by tab
 * Tracks total number of FOs in each status category
 */
export interface FOTotals {
  em_curso: number
  pendentes: number
}

/**
 * Active tab types for the producao page
 */
export type ProducaoTab = 'em_curso' | 'concluidos' | 'pendentes'

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'
