export interface FolhaObra {
  id: string
  numero_orc?: string
  numero_fo?: string
  cliente?: string
  id_cliente?: string
  saiu?: boolean
}

export interface ItemBase {
  id: string
  descricao?: string
  codigo?: string
  quantidade?: number | null
  brindes?: boolean
  folha_obra_id?: string
  folhas_obras?: FolhaObra
}

export interface LogisticaRecord {
  id: string
  data: string
  guia?: string
  local_recolha?: string
  local_entrega?: string
  id_local_recolha?: string
  id_local_entrega?: string
  transportadora?: string
  notas?: string
  saiu?: boolean
  concluido?: boolean
  data_concluido?: string
  data_saida?: string // Added field for departure date
  numero_fo?: string // Direct FO number (for standalone entries)
  numero_orc?: number // Direct ORC number (for standalone entries)
  cliente?: string // Direct cliente name (for standalone entries)
  nome_campanha?: string // Direct campaign name (for standalone entries)
  folha_obra_with_orcamento?: {
    numero_orc?: string
  }
  items_base?: ItemBase
  contacto?: string
  telefone?: string
  contacto_entrega?: string
  telefone_entrega?: string
  quantidade?: number | null
  descricao?: string // Direct item description in logistics table
}

export interface Cliente {
  value: string
  label: string
  morada?: string | null
  codigo_pos?: string | null
}

export interface Transportadora {
  value: string
  label: string
}

export interface Armazem {
  value: string
  label: string
  morada?: string | null
  codigo_pos?: string | null
}
