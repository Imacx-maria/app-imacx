/**
 * JobDrawer Types
 * Type definitions for the Job Drawer component
 */

import type { Job, Item } from '@/types/producao'

// Re-export centralized types for convenience
export type { Job, Item }

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
