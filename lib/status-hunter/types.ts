// Status Hunter Types - Deterministic state machine for job status queries

export type SearchType = 'FO' | 'ORC' | 'GUIA' | 'CLIENTE' | 'CAMPANHA' | 'ITEM';

// API Request/Response types
export interface QueryRequest {
  type: SearchType;
  value: string;
}

export interface Match {
  type: string;
  id: string;
  label: string;
  metadata: {
    cliente?: string;
    campanha?: string;
    fo_number?: string;
    orc_number?: string;
    total_items?: number;
  };
}

export interface DesignerStatus {
  name: string | null;
  stage: string;
  steps: Record<string, string | null>;
  paginacao: boolean;
  paginacao_date: string | null;
}

export interface LogisticsEntry {
  id: string;
  delivered: boolean;
  guia: string | null;
  transportadora: string | null;
  local_entrega: string | null;
  qty_delivered: number | null;
  data_saida: string | null;
  days_in_production: number;
}

export interface ItemStatus {
  id: string;
  descricao: string;
  quantidade: number;
  designer: DesignerStatus;
  logistics: LogisticsEntry[];
}

export interface FOStatus {
  id: string;
  fo_number: string;
  orc_number: string;
  cliente: string;
  campanha: string;
  created_at: string;
}

export interface FullStatus {
  fo: FOStatus;
  items: ItemStatus[];
}

export interface QueryResponse {
  matches: Match[];
  fullStatus?: FullStatus;
}

// Chat state machine types
export type ChatState =
  | { state: 'ask-type' }
  | { state: 'ask-value'; searchType: SearchType }
  | { state: 'searching'; searchType: SearchType; value: string }
  | { state: 'choose-match'; matches: Match[] }
  | { state: 'show-status'; fullStatus: FullStatus }
  | { state: 'error'; message: string };

// UI Text constants (Portuguese)
export const UI_TEXT = {
  askType: "O que pretende pesquisar?",
  askValue: {
    FO: "Insira o numero da Folha de Obra:",
    ORC: "Insira o numero do Orcamento:",
    GUIA: "Insira o numero da Guia:",
    CLIENTE: "Insira o nome do Cliente:",
    CAMPANHA: "Insira o nome da Campanha:",
    ITEM: "Insira a descricao ou codigo do Item:",
  },
  searchTypeLabels: {
    FO: "Folha de Obra",
    ORC: "Orcamento",
    GUIA: "Guia",
    CLIENTE: "Cliente",
    CAMPANHA: "Campanha",
    ITEM: "Item",
  },
  searching: "A pesquisar...",
  noResults: "Nao foram encontrados resultados.",
  multipleResults: "Encontramos varios resultados. Selecione um:",
  quickActions: {
    moreItems: "Ver mais itens desta FO",
    logisticsOnly: "Ver apenas logistica",
    designerProgress: "Ver progresso do designer",
    waitingApproval: "Itens aguardando aprovacao",
    newSearch: "Nova pesquisa",
  },
  designer: {
    noDesigner: "Sem designer atribuido",
    stage: "Estado atual",
  },
  logistics: {
    delivered: "Entregue",
    pending: "Pendente",
    guia: "Guia",
    carrier: "Transportadora",
    destination: "Destino",
    daysInProduction: "dias em producao",
  },
} as const;

// Raw database row types for query results
export interface RawFOSearchRow {
  id: string;
  fo_number: string;
  numero_orc: string | null;
  cliente: string | null;
  campanha: string | null;
  created_at: string | null;
  total_items: number | null;
}

export interface RawItemSearchRow {
  id: string;
  descricao: string | null;
  codigo: string | null;
  quantidade: number | null;
  fo_number: string | null;
  cliente: string | null;
}

export interface RawGuiaSearchRow {
  id: string;
  guia: string | null;
  transportadora: string | null;
  local_entrega: string | null;
  saiu: boolean | null;
  data_saida: string | null;
  item: string | null;
  fo_number: string | null;
  cliente: string | null;
}

export interface RawFullStatusRow {
  fo_number: string;
  orc_number: string | null;
  cliente: string | null;
  campanha: string | null;
  fo_created: string | null;
  item_id: string;
  item: string | null;
  qty: number | null;
  designer: string | null;
  m1: boolean | null;
  data_maquete_enviada1: string | null;
  a1: boolean | null;
  data_aprovacao_recebida1: string | null;
  R1: boolean | null;
  R1_date: string | null;
  m2: boolean | null;
  data_maquete_enviada2: string | null;
  a2: boolean | null;
  data_aprovacao_recebida2: string | null;
  R2: boolean | null;
  R2_date: string | null;
  m3: boolean | null;
  data_maquete_enviada3: string | null;
  a3: boolean | null;
  data_aprovacao_recebida3: string | null;
  R3: boolean | null;
  R3_date: string | null;
  m4: boolean | null;
  data_maquete_enviada4: string | null;
  a4: boolean | null;
  data_aprovacao_recebida4: string | null;
  R4: boolean | null;
  R4_date: string | null;
  m5: boolean | null;
  data_maquete_enviada5: string | null;
  a5: boolean | null;
  data_aprovacao_recebida5: string | null;
  R5: boolean | null;
  R5_date: string | null;
  m6: boolean | null;
  data_maquete_enviada6: string | null;
  a6: boolean | null;
  data_aprovacao_recebida6: string | null;
  R6: boolean | null;
  R6_date: string | null;
  paginacao: boolean | null;
  data_paginacao: string | null;
  logistics_id: string | null;
  delivered: boolean | null;
  guia: string | null;
  transportadora: string | null;
  local_entrega: string | null;
  qty_delivered: number | null;
  data_saida: string | null;
  days_in_production: number | null;
}
