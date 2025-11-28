import type {
  Job,
  Item,
  ClienteOption,
  SortableJobKey,
  SortDirection,
  DuplicateDialogState,
} from "@/types/producao";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Props for individual table row component
 */
export interface JobTableRowProps {
  job: Job;
  allItems: Item[];
  allOperacoes: any[];
  allDesignerItems: any[];
  clientes: ClienteOption[];
  jobsCompletionStatus: Record<string, { completed: boolean; percentage: number }>;
  jobTotalValues: Record<string, number>;
  loading: { clientes: boolean };
  variant: "em_curso" | "pendentes" | "concluidos";

  // Callbacks
  onJobUpdate: (jobId: string, updates: Partial<Job>) => void;
  onJobDelete: (jobId: string) => Promise<void>;
  onOpenDrawer: (jobId: string) => void;
  onClientesUpdate: (newClientes: ClienteOption[]) => void;

  // Validation callbacks
  checkOrcDuplicate: (value: string, excludeJobId: string) => Promise<Job | null>;
  checkFoDuplicate: (value: string, excludeJobId: string) => Promise<Job | null>;
  prefillAndInsertFromOrc: (orcNumber: string, tempJobId: string) => Promise<void>;
  prefillAndInsertFromFo: (foNumber: string, tempJobId: string) => Promise<void>;

  // Dialog callback
  setDuplicateDialog: (state: DuplicateDialogState) => void;

  // Supabase client for direct updates
  supabase: SupabaseClient;
}

/**
 * Props for the jobs table component
 */
export interface JobsTableProps {
  jobs: Job[];
  allItems: Item[];
  allOperacoes: any[];
  allDesignerItems: any[];
  clientes: ClienteOption[];
  jobsCompletionStatus: Record<string, { completed: boolean; percentage: number }>;
  jobTotalValues: Record<string, number>;
  loading: { jobs: boolean; clientes: boolean };
  variant: "em_curso" | "pendentes" | "concluidos";

  // Sorting
  sortCol: SortableJobKey;
  sortDir: SortDirection;
  onToggleSort: (col: SortableJobKey) => void;

  // Callbacks
  onJobsUpdate: React.Dispatch<React.SetStateAction<Job[]>>;
  onJobDelete: (jobId: string) => Promise<void>;
  onOpenDrawer: (jobId: string) => void;
  onClientesUpdate: (newClientes: ClienteOption[]) => void;
  onAllItemsUpdate: React.Dispatch<React.SetStateAction<Item[]>>;

  // Validation callbacks
  checkOrcDuplicate: (value: string, excludeJobId: string) => Promise<Job | null>;
  checkFoDuplicate: (value: string, excludeJobId: string) => Promise<Job | null>;
  prefillAndInsertFromOrc: (orcNumber: string, tempJobId: string) => Promise<void>;
  prefillAndInsertFromFo: (foNumber: string, tempJobId: string) => Promise<void>;

  // Dialog callback
  setDuplicateDialog: (state: DuplicateDialogState) => void;

  // Supabase client
  supabase: SupabaseClient;
}

/**
 * Column configuration for different variants
 */
export interface ColumnConfig {
  key: SortableJobKey | "actions";
  label: string;
  tooltip?: string;
  width: string;
  sortable: boolean;
  align?: "left" | "center" | "right";
  visible: {
    em_curso: boolean;
    pendentes: boolean;
    concluidos: boolean;
  };
}

/**
 * Default columns configuration
 */
export const COLUMNS: ColumnConfig[] = [
  { key: "created_at", label: "Data", width: "w-[140px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "numero_orc", label: "ORC", width: "w-[90px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "numero_fo", label: "FO", width: "w-[90px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "cliente" as SortableJobKey, label: "Cliente", width: "w-[200px]", sortable: true, visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "nome_campanha", label: "Nome Campanha", width: "flex-1", sortable: true, visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "notas", label: "Nota", width: "w-[50px]", sortable: true, visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "prioridade", label: "Status", width: "w-[210px]", sortable: true, visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "total_value", label: "Valor", width: "w-[120px]", sortable: true, align: "right", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "prioridade", label: "P", tooltip: "Prioridade", width: "w-[36px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "artwork" as SortableJobKey, label: "A", tooltip: "Artes Finais", width: "w-[36px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "corte" as SortableJobKey, label: "C", tooltip: "Corte", width: "w-[36px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
  { key: "pendente" as SortableJobKey, label: "SB", tooltip: "Stand By", width: "w-[40px]", sortable: true, align: "center", visible: { em_curso: true, pendentes: true, concluidos: false } },
  { key: "actions" as any, label: "Ações", width: "w-[100px]", sortable: false, align: "center", visible: { em_curso: true, pendentes: true, concluidos: true } },
];
