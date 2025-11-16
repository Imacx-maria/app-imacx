/**
 * Financial Analysis Types
 * Type definitions for financial analysis data structures
 */

// ============================================================================
// Metric Types
// ============================================================================

export interface MetricValue {
  current: number;
  previous: number;
  change: number; // Percentage change
}

export interface PeriodMetrics {
  revenue: MetricValue;
  invoices: MetricValue;
  customers: MetricValue;
  avgInvoiceValue: MetricValue;
  quoteValue: MetricValue;
  quoteCount: MetricValue;
  conversionRate: MetricValue;
  avgQuoteValue: MetricValue;
}

// ============================================================================
// KPI Dashboard Types
// ============================================================================

export interface KPIDashboardData {
  mtd: PeriodMetrics;
  ytd: PeriodMetrics;
  qtd: PeriodMetrics;
  generatedAt: string;
}

// ============================================================================
// Monthly Revenue Types
// ============================================================================

export interface MonthlyRevenueData {
  period: string; // YYYY-MM format
  totalInvoices: number;
  validInvoices: number;
  cancelledInvoices: number;
  netRevenue: number;
  cancelledValue: number;
  grossRevenue: number;
  cancellationRate: number; // Percentage
  avgInvoiceValue: number;
}

export interface MonthlyRevenueSummary {
  totalInvoices: number;
  validInvoices: number;
  cancelledInvoices: number;
  netRevenue: number;
  cancelledValue: number;
  grossRevenue: number;
  cancellationRate: number;
  avgInvoiceValue: number;
}

export interface MonthlyRevenueResponse {
  monthlyData: MonthlyRevenueData[];
  summary: MonthlyRevenueSummary;
  metadata: {
    startDate: string;
    endDate: string;
    monthsAnalyzed: number;
    generatedAt: string;
  };
}

// ============================================================================
// Top Customers Types
// ============================================================================

export interface TopCustomer {
  rank: number;
  customerId: string;
  customerName: string;
  city: string;
  salesperson: string;
  invoiceCount: number;
  netRevenue: number;
  cancelledRevenue: number;
  revenueSharePct: number;
  firstInvoice: string; // ISO date
  lastInvoice: string; // ISO date
  daysSinceLastInvoice: number;

  /**
   * YTD only: previous year YTD net revenue for this customer.
   */
  previousNetRevenue?: number;

  /**
   * YTD only: absolute delta vs previousNetRevenue (current - previous).
   */
  previousDeltaValue?: number;

  /**
   * YTD only: percentage delta vs previousNetRevenue.
   * Positive = growth, negative = decline.
   */
  previousDeltaPct?: number | null;
}

export interface TopCustomersSummary {
  totalCustomers: number;
  totalRevenue: number;
  totalInvoices: number;
  topCustomersRevenue: number;
  topCustomersSharePct: number;
}

export interface TopCustomersResponse {
  customers: TopCustomer[];
  summary: TopCustomersSummary;
  metadata: {
    period: "ytd" | "12months" | "mtd";
    startDate: string;
    endDate: string;
    limit: number;
    generatedAt: string;
  };
}

// ============================================================================
// Salesperson Performance Types
// ============================================================================

export interface SalespersonMetrics {
  salesperson: string;
  period: string; // YYYY-MM format
  invoiceCount: number;
  uniqueCustomers: number;
  netRevenue: number;
  cancelledRevenue: number;
  cancellationRate: number;
}

export interface SalespersonSummary {
  salesperson: string;
  totalOrders: number;
  uniqueCustomers: number;
  totalOrderValue: number;
  avgOrderValue: number;
}

// ============================================================================
// Cost Center Types
// ============================================================================

export interface CostCenterMetrics {
  costCenter: string;
  period: string; // YYYY-Q format for quarters
  revenue: number;
  invoiceCount: number;
  quarterSharePct: number;
}

export interface CostCenterSummary {
  costCenter: string;
  totalInvoices: number;
  uniqueCustomers: number;
  totalRevenue: number;
  avgLineValue: number;
  revenueSharePct: number;
}

// ============================================================================
// Cost Center Multi-Year YTD Comparison Types
// ============================================================================

export interface CostCenterYTD {
  costCenter: string;
  currentYear: number;
  previousYear: number;
  twoYearsAgo: number;
  yoyChangePct: number | null;
  twoYearChangePct: number | null;
}

export interface CostCenterPerformanceResponse {
  costCenters: CostCenterYTD[];
  years: number[]; // e.g. [2025, 2024, 2023]
  metadata: {
    generatedAt: string;
    currentYear: number;
    currentMonth: number;
    currentDay: number;
    period: string; // "mtd" or "ytd"
    periodLabel: string; // e.g. "novembro 2025" or "Jan - 14 nov"
    ytdEndDate: string;
    totalCostCenters: number;
  };
}

// ============================================================================
// Cost Center Top Customers Types
// ============================================================================

export interface CostCenterTopCustomer {
  rank: number;
  customerId: string;
  customerName: string;
  city: string;
  salesperson: string;
  invoiceCount: number;
  quoteCount: number;
  conversionRate: number | null;
  netRevenue: number;
  revenueSharePct: number;
  lastInvoice: string;
  daysSinceLastInvoice: number;
}

export interface CostCenterTopCustomersBlock {
  costCenter: string;
  customers: CostCenterTopCustomer[];
  summary: {
    totalCustomers: number;
    totalRevenue: number;
    totalInvoices: number;
  };
}

export interface CostCenterTopCustomersResponse {
  costCenters: CostCenterTopCustomersBlock[];
  metadata: {
    period: "ytd" | "mtd";
    startDate: string;
    endDate: string;
    limit: number;
    generatedAt: string;
  };
}

// ============================================================================
// Geographic Analysis Types
// ============================================================================

export interface GeographicMetrics {
  city: string;
  customers: number;
  invoices: number;
  netRevenue: number;
  revenueSharePct: number;
  avgInvoiceValue: number;
}

// ============================================================================
// Cancellation Analysis Types
// ============================================================================

export interface CancellationMetrics {
  period: string; // YYYY-MM format
  documentType: string;
  salesperson: string;
  cancelledCount: number;
  totalCount: number;
  cancellationRateCount: number;
  cancelledValue: number;
  cancellationRateValue: number;
}

// ============================================================================
// Customer Concentration Risk Types
// ============================================================================

export interface ConcentrationRisk {
  customerGroup: string; // 'Top 1', 'Top 5', 'Top 10', etc.
  revenue: number;
  pctOfTotal: number;
}

// ============================================================================
// Multi-Year Revenue Types (for Vendas 3-year YTD chart)
// ============================================================================

export interface MultiYearRevenuePoint {
  month: string; // YYYY-MM
  revenue: number;
}

export interface MultiYearRevenueSeries {
  year: number;
  points: MultiYearRevenuePoint[];
}

export interface MultiYearRevenueResponse {
  years: number[]; // e.g. [2025, 2024, 2023]
  months: string[]; // canonical YYYY-MM for months up to current YTD month
  series: MultiYearRevenueSeries[];
}

// ============================================================================
// Chart Data Types
// ============================================================================

export type ChartType =
  | "line"
  | "bar"
  | "table"
  | "heatmap"
  | "scatter"
  | "pie"
  | "area";

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number; // Additional properties for multi-series charts
}

export interface FinancialChartConfig {
  metricName: string;
  data: ChartDataPoint[];
  chartType: ChartType;
  insights?: string[];
  actions?: string[];
  dataQualityNotes?: string[];
}

// ============================================================================
// API Response Wrapper Types
// ============================================================================

export interface APIError {
  error: string;
  details?: string;
}

export type APIResponse<T> = T | APIError;

export function isAPIError(response: any): response is APIError {
  return response && typeof response.error === "string";
}

// ============================================================================
// Filter and Query Types
// ============================================================================

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface FinancialAnalysisFilters {
  period?: "ytd" | "qtd" | "mtd" | "12months" | "24months" | "custom";
  dateRange?: DateRange;
  salesperson?: string;
  costCenter?: string;
  city?: string;
  customerId?: string;
  limit?: number;
}

// ============================================================================
// Dashboard State Types
// ============================================================================

export interface DashboardState {
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export interface FinancialAnalysisDashboard {
  kpi: KPIDashboardData | null;
  monthlyRevenue: MonthlyRevenueResponse | null;
  topCustomers: TopCustomersResponse | null;
  state: DashboardState;
}
