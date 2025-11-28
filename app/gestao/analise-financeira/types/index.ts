// Types for the Analise Financeira page

// ====================================
// CORE DATA TYPES
// ====================================

export interface KPIData {
  totalInvoiced: number;
  totalInvoicedPreviousYear: number;
  totalInvoicedPreviousYearSamePeriod: number;
  totalInvoiced2YearsAgoSamePeriod: number;
  yoyGrowth: number;
  yoyGrowthSamePeriod: number;
  totalQuoted: number;
  conversionRate: number;
  avgTicket: number;
  avgTicketPreviousYear: number;
  avgTicketYoYGrowth: number;
  activeClients: number;
  activeClientsPreviousYear: number;
  clientGrowth: number;
  generatedAt: string;
}

export interface MonthlyData {
  month: string;
  faturado: number;
  previous_year: number;
  two_years_ago: number;
}

export interface DepartmentData {
  departamento: string;
  faturado: number;
  percentagem: number;
  quantidade: number;
  faturado_anterior?: number;
  percentagem_anterior?: number;
  yoy_growth?: number;
}

export interface CentroCustoData {
  centro_custo: string;
  nome_centro_custo: string;
  faturado: number;
  percentagem: number;
  quantidade: number;
  ticket_medio: number;
  faturado_anterior?: number;
  percentagem_anterior?: number;
  yoy_growth?: number;
}

export interface ClientData {
  cliente: string;
  nome: string;
  faturado: number;
  quantidade: number;
  ticket_medio: number;
  percentagem: number;
}

export interface MonthlyClientData {
  month: string;
  clientes_ativos: number;
  novos_clientes: number;
}

export interface PipelineData {
  total_pipeline: number;
  orcamentos_pendentes: number;
  avg_dias_pendente: number;
  conversion_rate_30d: number;
}

export interface WeeklyComparisonData {
  week: string;
  current_year: number;
  previous_year: number;
  two_years_ago: number;
}

export interface ConversionData {
  month: string;
  total_quotes: number;
  converted_quotes: number;
  conversion_rate: number;
}

export interface CompanyData {
  company_id: string;
  company_name: string;
  total_faturado: number;
  total_orcamentado: number;
  total_invoices: number;
  total_quotes: number;
  conversion_rate: number;
}

export interface CompanyComparisonData {
  company: string;
  current_year: number;
  previous_year: number;
  yoy_growth: number;
}

// ====================================
// CENTRO CUSTO / COST CENTER TYPES
// ====================================

export interface CentroCustoYearData {
  centro_custo: string;
  nome_centro_custo: string;
  faturado: number;
  quantidade: number;
  ticket_medio: number;
  percentagem: number;
}

export interface CentroCustoDetailData {
  centro_custo: string;
  nome_centro_custo: string;
  month: number;
  faturado: number;
  quantidade: number;
}

export interface CentroCustoMonthlyBreakdown {
  centro_custo: string;
  nome_centro_custo: string;
  months: { month: number; faturado: number; quantidade: number }[];
  total: number;
}

// ====================================
// DEPARTMENT TYPES
// ====================================

export interface DeptYearData {
  departamento: string;
  faturado: number;
  quantidade: number;
  ticket_medio: number;
  percentagem: number;
}

export interface DeptMonthlyBreakdown {
  departamento: string;
  months: { month: number; faturado: number; quantidade: number }[];
  total: number;
}

// ====================================
// SORTING TYPES
// ====================================

export type SortDirection = "asc" | "desc";

export type CCSortColumn =
  | "centro_custo"
  | "nome_centro_custo"
  | "faturado"
  | "quantidade"
  | "ticket_medio"
  | "percentagem"
  | "yoy_growth";

export type DeptSortColumn =
  | "departamento"
  | "faturado"
  | "quantidade"
  | "ticket_medio"
  | "percentagem"
  | "yoy_growth";

export type ClientSortColumn =
  | "nome"
  | "faturado"
  | "quantidade"
  | "ticket_medio"
  | "percentagem";

export type CompanySortColumn =
  | "company_name"
  | "total_faturado"
  | "total_orcamentado"
  | "conversion_rate"
  | "yoy_growth";

// ====================================
// SORTING STATE INTERFACES
// ====================================

export interface SortState<T extends string> {
  column: T;
  direction: SortDirection;
}

// ====================================
// TAB TYPES
// ====================================

export type MainTab =
  | "visao-geral"
  | "centro-custo"
  | "departamentos"
  | "tabelas-temp"
  | "operacoes";

export type TempTableSelection =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15";

// ====================================
// HELPER INTERFACES
// ====================================

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  suffix?: string;
  prefix?: string;
  valueClassName?: string;
  description?: string;
}

// ====================================
// CHART DATA TYPES
// ====================================

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface MonthlyChartData {
  name: string;
  faturado: number;
  previous_year: number;
  two_years_ago?: number;
}

export interface DepartmentChartData {
  name: string;
  value: number;
  fill: string;
}

// ====================================
// SUPABASE RPC RESPONSE TYPES
// ====================================

export interface RPCKPIResponse {
  total_invoiced: number;
  total_invoiced_previous_year: number;
  total_invoiced_previous_year_same_period: number;
  total_invoiced_2_years_ago_same_period: number;
  yoy_growth: number;
  yoy_growth_same_period: number;
  total_quoted: number;
  conversion_rate: number;
  avg_ticket: number;
  avg_ticket_previous_year: number;
  avg_ticket_yoy_growth: number;
  active_clients: number;
  active_clients_previous_year: number;
  client_growth: number;
}

export interface RPCMonthlyResponse {
  month: string;
  faturado: number;
  previous_year: number;
  two_years_ago: number;
}

export interface RPCDepartmentResponse {
  departamento: string;
  faturado: number;
  percentagem: number;
  quantidade: number;
}

export interface RPCCentroCustoResponse {
  centro_custo: string;
  nome_centro_custo: string;
  faturado: number;
  percentagem: number;
  quantidade: number;
  ticket_medio: number;
}

export interface RPCClientResponse {
  cliente: string;
  nome: string;
  faturado: number;
  quantidade: number;
  ticket_medio: number;
  percentagem: number;
}

export interface RPCWeeklyResponse {
  week: string;
  current_year: number;
  previous_year: number;
  two_years_ago: number;
}

export interface RPCConversionResponse {
  month: string;
  total_quotes: number;
  converted_quotes: number;
  conversion_rate: number;
}

export interface RPCCompanyResponse {
  company_id: string;
  company_name: string;
  total_faturado: number;
  total_orcamentado: number;
  total_invoices: number;
  total_quotes: number;
  conversion_rate: number;
}
