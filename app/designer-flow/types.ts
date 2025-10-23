export interface DesignerItem {
  id: string // designer_items.id
  item_id: string // items_base.id
  em_curso: boolean | null
  duvidas: boolean | null
  maquete_enviada1: boolean | null
  aprovacao_recebida1: boolean | null
  maquete_enviada2: boolean | null
  aprovacao_recebida2: boolean | null
  maquete_enviada3: boolean | null
  aprovacao_recebida3: boolean | null
  maquete_enviada4: boolean | null
  aprovacao_recebida4: boolean | null
  maquete_enviada5: boolean | null
  aprovacao_recebida5: boolean | null
  maquete_enviada6?: boolean | null
  aprovacao_recebida6?: boolean | null
  r1?: boolean | null
  r2?: boolean | null
  r3?: boolean | null
  r4?: boolean | null
  r5?: boolean | null
  r6?: boolean | null
  paginacao: boolean | null
  data_in: string | null
  data_em_curso: string | null
  data_duvidas: string | null
  data_maquete_enviada1: string | null
  data_aprovacao_recebida1: string | null
  data_maquete_enviada2: string | null
  data_aprovacao_recebida2: string | null
  data_maquete_enviada3: string | null
  data_aprovacao_recebida3: string | null
  data_maquete_enviada4: string | null
  data_aprovacao_recebida4: string | null
  data_maquete_enviada5: string | null
  data_aprovacao_recebida5: string | null
  data_maquete_enviada6?: string | null
  data_aprovacao_recebida6?: string | null
  R1_date?: string | null
  R2_date?: string | null
  R3_date?: string | null
  R4_date?: string | null
  R5_date?: string | null
  R6_date?: string | null
  data_paginacao: string | null
  data_saida: string | null
  path_trabalho: string | null
  updated_at: string | null
  items_base: ItemBase | ItemBase[]
}

export interface ItemBase {
  id: string
  folha_obra_id: string
  descricao: string
  codigo: string | null
  quantidade: number | null
  complexidade_id?: string | null
  complexidade?: string | null
}

export interface Item extends ItemBase {
  designer_item_id: string
  em_curso: boolean | null
  duvidas: boolean | null
  maquete_enviada1: boolean | null
  aprovacao_recebida1: boolean | null
  maquete_enviada2: boolean | null
  aprovacao_recebida2: boolean | null
  maquete_enviada3: boolean | null
  aprovacao_recebida3: boolean | null
  maquete_enviada4: boolean | null
  aprovacao_recebida4: boolean | null
  maquete_enviada5: boolean | null
  aprovacao_recebida5: boolean | null
  maquete_enviada6?: boolean | null
  aprovacao_recebida6?: boolean | null
  r1?: boolean | null
  r2?: boolean | null
  r3?: boolean | null
  r4?: boolean | null
  r5?: boolean | null
  r6?: boolean | null
  paginacao: boolean | null
  notas?: string | null
  data_in: string | null
  data_em_curso: string | null
  data_duvidas: string | null
  data_maquete_enviada1: string | null
  data_aprovacao_recebida1: string | null
  data_maquete_enviada2: string | null
  data_aprovacao_recebida2: string | null
  data_maquete_enviada3: string | null
  data_aprovacao_recebida3: string | null
  data_maquete_enviada4: string | null
  data_aprovacao_recebida4: string | null
  data_maquete_enviada5: string | null
  data_aprovacao_recebida5: string | null
  data_maquete_enviada6?: string | null
  data_aprovacao_recebida6?: string | null
  R1_date?: string | null
  R2_date?: string | null
  R3_date?: string | null
  R4_date?: string | null
  R5_date?: string | null
  R6_date?: string | null
  data_paginacao: string | null
  data_saida: string | null
  path_trabalho: string | null
  updated_at: string | null
}

export interface Job {
  id: string
  created_at: string
  numero_fo: string | number
  numero_orc: string | number | null
  nome_campanha: string
  data_saida: string | null
  prioridade: boolean | null
  profile_id?: string | null
  notas?: string
}

export interface Designer {
  value: string
  label: string
}

export interface UpdateItemParams {
  designerItemId: string
  updates: Partial<DesignerItem>
}
