/**
 * Status Color Helper Functions for Producao Module
 * Extracted from app/producao/page.tsx for better organization
 *
 * These functions determine status indicator colors based on job/item state
 */

import type { Job, Item } from '@/types/producao'

/**
 * Simple status dot color helper
 * @param v - Boolean value (true = success, false = destructive)
 * @param warn - If true, uses warning color instead of destructive for false values
 * @returns Tailwind CSS class for background color
 */
export const dotColor = (v?: boolean | null, warn = false): string =>
  v ? 'bg-success' : warn ? 'bg-warning' : 'bg-destructive'

/**
 * Get Priority (P) indicator color
 * - Red (destructive) if job has priority flag
 * - Blue (info) if job is older than 3 days
 * - Green (success) otherwise
 *
 * @param job - Job object
 * @returns Tailwind CSS class for background color
 */
export const getPColor = (job: Job): string => {
  if (job.prioridade) return 'bg-destructive'
  if (job.data_in) {
    const days =
      (Date.now() - new Date(job.data_in).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return 'bg-info'
  }
  return 'bg-success'
}

/**
 * Get Artwork (A) indicator color based on paginacao completion
 * - Red (destructive) if no items or no designer items
 * - Red (destructive) if no items have paginacao completed
 * - Green (success) if all items have paginacao completed
 * - Orange (warning) if some items have paginacao completed
 *
 * @param jobId - Job ID
 * @param items - All items array
 * @param designerItems - All designer items array
 * @returns Tailwind CSS class for background color
 */
export const getAColor = (
  jobId: string,
  items: Item[],
  designerItems: any[],
): string => {
  // Get all items for this job
  const jobItems = items.filter((item) => item.folha_obra_id === jobId)
  if (jobItems.length === 0) return 'bg-destructive' // No items = red

  // Get designer items for these job items
  const jobItemIds = jobItems.map((item) => item.id)
  const jobDesignerItems = designerItems.filter((designer) =>
    jobItemIds.includes(designer.item_id),
  )

  if (jobDesignerItems.length === 0) return 'bg-destructive' // No designer items = red

  // Check paginacao status
  const completedCount = jobDesignerItems.filter(
    (designer) => designer.paginacao === true,
  ).length
  const totalCount = jobDesignerItems.length

  if (completedCount === 0) return 'bg-destructive' // None completed = red
  if (completedCount === totalCount) return 'bg-success' // All completed = green
  return 'bg-warning' // Some completed = orange
}

/**
 * Get Corte (C) indicator color based on operations completion
 * - Red (destructive) if no operations exist
 * - Green (success) if any operation is completed
 * - Red (destructive) if no operations are completed
 *
 * @param jobId - Job ID
 * @param operacoes - All operations array
 * @returns Tailwind CSS class for background color
 */
export const getCColor = (jobId: string, operacoes: any[]): string => {
  const jobOperacoes = operacoes.filter((op) => op.folha_obra_id === jobId)
  if (jobOperacoes.length === 0) return 'bg-destructive'
  return jobOperacoes.some((op) => op.concluido)
    ? 'bg-success'
    : 'bg-destructive'
}
