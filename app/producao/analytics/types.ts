/**
 * Production Analytics Types
 *
 * TypeScript interfaces for production analytics data structures
 */

export type PeriodType = 'mtd' | 'ytd';

export interface ProductionKPIs {
  total_jobs: number;
  completed_jobs: number;
  completion_rate: number;
  avg_cycle_days: number;
  total_value_completed: number;
  jobs_without_logistics: number;
  jobs_without_value: number;
}

export interface CycleTimeRow {
  grouping_key: string;
  avg_days: number;
  job_count: number;
  min_days: number;
  max_days: number;
  total_value: number;
}

export interface ComplexityDistribution {
  complexidade: string;
  job_count: number;
  item_count: number;
  avg_completion_days: number;
  total_value: number;
}

export interface ValueDistribution {
  value_bracket: string;
  job_count: number;
  avg_completion_days: number;
  total_value: number;
  completion_rate: number;
}

export interface DesignerLeadTime {
  grouping_key: string;
  avg_days_to_first_mockup: number;
  job_count: number;
  min_days: number;
  max_days: number;
}

export interface BottleneckJob {
  job_id: string;
  numero_fo: string;
  numero_orc: string;
  nome_campanha: string;
  cliente: string;
  days_in_production: number;
  job_value: number;
  has_logistics: boolean;
  total_items: number;
  completed_items: number;
  missing_data: string;
}

export interface ChartDataPoint {
  [key: string]: string | number;
}
