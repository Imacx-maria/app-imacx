// Designer Analytics Types
// Created: 2025-11-20

export interface DesignerKPIs {
  total_items: number
  completed_items: number
  in_progress_items: number
  avg_cycle_days: number
  first_time_approval_rate: number
  revision_rate: number
  bottleneck_items: number
}

export interface ComplexityDistributionRow {
  complexidade: string
  designer: string
  item_count: number
}

export interface CycleTimeRow {
  grouping_key: string
  avg_days_entrada_saida: number
  avg_days_entrada_paginacao: number
  completed_items: number
  min_days: number
  max_days: number
}

export interface WorkloadRow {
  month: string
  designer: string
  active_items: number
  completed_items: number
  avg_completion_days: number
}

export interface RevisionMetrics {
  total_items: number
  items_with_revisions: number
  revision_rate: number
  r1_count: number
  r2_count: number
  r3_count: number
  r4_count: number
  r5_count: number
  r6_count: number
  avg_revisions_per_item: number
}

export interface BottleneckItem {
  designer_item_id: string
  numero_fo: string
  nome_campanha: string
  descricao: string
  designer: string
  current_stage: string
  days_in_stage: number
  complexidade: string
  last_updated: string
}

export interface ApprovalCycleMetrics {
  avg_cycles: number
  first_time_approval_rate: number
  items_with_1_cycle: number
  items_with_2_cycles: number
  items_with_3_cycles: number
  items_with_4_cycles: number
  items_with_5_cycles: number
  items_with_6_cycles: number
  total_items: number
}

export type PeriodType = 'mtd' | 'ytd' | 'custom'

export interface AnalyticsFilters {
  period: PeriodType
  customStartDate?: string
  customEndDate?: string
}

export interface ChartDataPoint {
  [key: string]: string | number
}
