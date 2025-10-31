/**
 * JobDrawer Types
 * Type definitions for the Job Drawer component
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

export interface JobDrawerProps {
  jobId: string
  jobs: Job[]
  items: Item[]
  onClose(): void
  supabase: any
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>
  setAllItems: React.Dispatch<React.SetStateAction<Item[]>>
  fetchJobsSaiuStatus: (jobIds: string[]) => Promise<void>
  fetchJobsCompletionStatus: (jobIds: string[]) => Promise<void>
}
