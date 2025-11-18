/**
 * JobDrawer Types
 * Type definitions for the Job Drawer component and sub-components
 */

import type { Job, Item } from "@/types/producao";
import type { Cliente } from "@/types/logistica";

// Re-export centralized types for convenience
export type { Job, Item };

export interface JobDrawerProps {
  jobId: string;
  jobs: Job[];
  items: Item[];
  onClose(): void;
  supabase: any;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  setAllItems: React.Dispatch<React.SetStateAction<Item[]>>;
  fetchJobsSaiuStatus: (jobIds: string[]) => Promise<void>;
  fetchJobsCompletionStatus: (jobIds: string[]) => Promise<void>;
  onRefreshValorFromPhc?: (jobId: string) => Promise<void>;
}

// JobHeader props
export interface JobHeaderProps {
  job: Job;
}

// TopActions props
export interface TopActionsProps {
  job: Job | null;
  onClose: () => void;
  onRefreshValor?: () => void;
  refreshingValor?: boolean;
}

// JobProducao props
export interface JobProducaoProps {
  job: Job;
  jobItems: Item[];
  supabase: any;

  // State management
  editingItems: Set<string>;
  tempValues: { [itemId: string]: Partial<Item> };
  savingItems: Set<string>;
  pendingItems: { [itemId: string]: Item };

  // Callbacks
  onAddItem: () => void;
  onAcceptItem: (item: Item) => Promise<void>;
  onSaveItem: (item: Item) => Promise<void>;
  onCancelEdit: (itemId: string) => void;
  onDuplicateItem: (item: Item) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
  onUpdateTempValue: (itemId: string, field: keyof Item, value: any) => void;
  onBrindesChange: (itemId: string, value: boolean) => Promise<void>;
  onStartEdit: (itemId: string, item: Item) => void;

  // Utility functions
  isEditing: (itemId: string) => boolean;
  isSaving: (itemId: string) => boolean;
  isNewItem: (itemId: string) => boolean;
  isPending: (itemId: string) => boolean;
  getDisplayValue: (item: Item, field: keyof Item) => any;
}

// JobLogistica props
export interface JobLogisticaProps {
  job: Job;
  supabase: any;
  logisticaRows: any[];
  logisticaLoading: boolean;
  logisticaClientes: Cliente[];
  extraClientes: Cliente[];
  logisticaTransportadoras: any[];
  logisticaArmazens: any[];
  sourceRowId: string | null;

  // Callbacks
  onRefreshLogistica: () => Promise<void>;
  onCopyDeliveryInfo: () => Promise<void>;
  onAddLogisticaRow: () => Promise<void>;
  onSourceRowChange: (rowId: string | null) => void;
  onFoSave: (row: any, foValue: string) => Promise<void>;
  onClienteChange: (row: any, value: string) => Promise<void>;
  onItemSave: (row: any, value: string) => Promise<void>;
  onConcluidoSave: (row: any, value: boolean) => Promise<void>;
  onDataConcluidoSave: (row: any, value: string) => Promise<void>;
  onSaiuSave: (row: any, value: boolean) => Promise<void>;
  onGuiaSave: (row: any, value: string) => Promise<void>;
  onBrindesSave: (row: any, value: boolean) => Promise<void>;
  onRecolhaChange: (rowId: string, value: string) => Promise<void>;
  onEntregaChange: (rowId: string, value: string) => Promise<void>;
  onTransportadoraChange: (row: any, value: string) => Promise<void>;
  onQuantidadeSave: (row: any, value: number | null) => Promise<void>;
  onDuplicateRow: (row: any) => Promise<void>;
  onNotasSave: (
    row: any,
    outras: string,
    contacto?: string,
    telefone?: string,
    contacto_entrega?: string,
    telefone_entrega?: string,
    data?: string | null
  ) => Promise<void>;
  onDeleteRow: (rowId: string) => Promise<void>;
  onArmazensUpdate: () => void;
  onTransportadorasUpdate: () => void;
  onClientesUpdate: () => void;
  setLogisticaRows: React.Dispatch<React.SetStateAction<any[]>>;
  setExtraClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
}
