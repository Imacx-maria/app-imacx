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
  created_at: string
  updated_at: string
}

export interface ProductionOperationWithRelations extends ProductionOperation {
  items_base?: any | null
  machines?: Machine | null
  profiles?: Profile | null
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
