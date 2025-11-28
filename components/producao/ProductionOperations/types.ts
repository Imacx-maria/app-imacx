/**
 * ProductionOperations Types
 * Type definitions for the Production Operations drawer and sub-components
 */

import type {
  ProductionItem,
  ProductionPlan,
  MaterialSummary,
  PlanExecutionSummary,
  PlanWithSummary,
  CuttingPlanWithSummary,
  ItemFullDetails,
  PlanType,
  ProcessType,
  PlanOrigin,
} from "@/types/producao";

// Re-export types for convenience
export type {
  ProductionItem,
  ProductionPlan,
  MaterialSummary,
  PlanExecutionSummary,
  PlanWithSummary,
  CuttingPlanWithSummary,
  ItemFullDetails,
  PlanType,
  ProcessType,
  PlanOrigin,
};

// Drawer Props
export interface ProductionOperationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | null;
  supabase: any;
  onRefresh?: () => void;
}

// Item Summary Card Props
export interface ItemSummaryCardProps {
  item: ProductionItem;
  materialSummary: MaterialSummary;
  progressImpressao: number;
  progressCorte: number;
}

// Material Consumption Card Props
export interface MaterialConsumptionCardProps {
  materialSummary: MaterialSummary;
}

// Plans Table Props
export interface PlansTableProps {
  plans: Array<{
    id: string;
    nome: string;
    quantidade_chapas: number;
    quantidade_executada: number;
    quantidade_falta: number;
    material_tipo?: string;
    origem: PlanOrigin;
  }>;
  onSelectPlan: (planId: string) => void;
  selectedPlanId: string | null;
  showMaterial: boolean;
  readOnly?: boolean;
}

// Executions Table Props
export interface ExecutionsTableProps {
  executions: Array<{
    id: string;
    data_hora: string;
    operador_nome?: string;
    maquina: string;
    quantidade_executada: number;
    notas?: string;
    material?: {
      tipo: string;
      espessura?: string;
      is_palette: boolean;
    };
  }>;
  showMaterial: boolean;
}

// New Execution Form Props
export interface NewExecutionFormProps {
  planoId: string;
  planoNome: string;
  operationType: "Impressao" | "Corte" | "Impressao_Flexiveis";
  quantidadeDisponivel?: number;
  onSubmit: (data: ExecutionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface ExecutionFormData {
  maquina: string;
  operador_id?: string;
  operador_nome: string;
  quantidade_executada: number;
  notas?: string;
}

// Add Plan Form Props
export interface AddPlanFormProps {
  itemId: string;
  tipo: PlanType;
  processo: ProcessType;
  existingPlanNames: string[];
  onSubmit: (plan: NewPlanData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface NewPlanData {
  nome: string;
  quantidade_chapas: number;
  // Material source
  material_source: "palette" | "individual";
  palette_number?: string;
  material_tipo?: string;
  material_espessura?: string;
  material_acabamento?: string;
  material_id?: string;
  // Print colors (only for impressão)
  cores?: string;
  notas?: string;
}

// Machines list
export const MACHINES = [
  "Agfa",
  "Vutek",
  "Latex",
  "Kongsberg",
  "Zund",
  "Manual",
] as const;

// Material types
export const MATERIAL_TYPES = [
  "Cartão",
  "PVC",
  "MDF",
  "Acrílico",
  "Forex",
  "Dibond",
  "Policarbonato",
  "Outros",
] as const;

// Material espessuras
export const MATERIAL_ESPESSURAS = [
  "1mm",
  "2mm",
  "3mm",
  "4mm",
  "5mm",
  "6mm",
  "8mm",
  "10mm",
  "15mm",
  "19mm",
  "20mm",
] as const;

// Material acabamentos
export const MATERIAL_ACABAMENTOS = [
  "Mate",
  "Brilho",
  "Fosco",
  "Acetinado",
  "Natural",
] as const;
