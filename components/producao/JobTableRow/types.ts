import type { Job, Item, ClienteOption, LoadingState } from "@/types/producao";

export type JobRowVariant = "em_curso" | "concluidos";

export interface JobTableRowProps {
  /** The job data to display */
  job: Job;
  /** Variant determines which columns are displayed */
  variant: JobRowVariant;
  /** Completion percentage from jobsCompletionStatus */
  completionPercentage: number;
  /** Total value for em_curso variant (euro_tota or cached) */
  jobTotalValue?: number | null;
  /** Client options for the combobox */
  clientes: ClienteOption[];
  /** Loading state */
  loading: LoadingState;
  /** Items for this job (used for getAColor and concluidos checkbox) */
  jobItems: Item[];
  /** Designer items for getAColor */
  designerItems: any[];
  /** Operacoes for getCColor */
  operacoes: any[];

  // Callbacks for ORC field
  onOrcChange: (jobId: string, value: string | null) => void;
  onOrcBlur: (job: Job, inputValue: string) => Promise<void>;

  // Callbacks for FO field
  onFoChange: (jobId: string, value: string) => void;
  onFoBlur: (job: Job, inputValue: string) => Promise<void>;

  // Callbacks for Cliente field
  onClienteChange: (job: Job, selectedId: string) => Promise<void>;
  onClientesUpdate: (newClientes: ClienteOption[]) => void;

  // Callbacks for Campanha field
  onCampanhaChange: (jobId: string, value: string) => void;
  onCampanhaBlur: (job: Job, value: string) => Promise<void>;

  // Callback for Notas
  onNotasSave: (job: Job, newNotas: string) => Promise<void>;

  // em_curso only callbacks
  onPrioridadeClick?: (job: Job) => Promise<void>;
  onPendenteChange?: (job: Job, checked: boolean) => Promise<void>;
  onViewClick?: (jobId: string) => void;
  onDeleteClick?: (job: Job) => Promise<void>;

  // concluidos only callback
  onItemsConcluidoChange?: (
    job: Job,
    checked: boolean,
    jobItems: Item[]
  ) => Promise<void>;
}
