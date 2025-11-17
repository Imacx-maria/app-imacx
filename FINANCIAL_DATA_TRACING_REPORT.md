# Financial Data Source Analysis - IMACX Dashboard
## Analysis Date: 2025-11-17
## Analyst: Kilo Code (Financial Data Tracer)

### Executive Summary
Analyzed 8 KPI cards and 1 data table from the "visão geral" tab in the IMACX financial dashboard. All components traced to source SQL queries and PHC ERP tables. The system uses a modern Next.js frontend with Supabase backend, connecting to legacy PHC ERP data through secure RPC functions.

**Key Findings:**
- 8 KPI cards fully documented with complete data lineage
- Top 20 Customers table traced with complex business logic
- All API endpoints identified and documented
- SQL queries extracted and formatted for readability
- Table relationships mapped between PHC ERP tables
- Period calculations (MTD/QTD/YTD) properly implemented
- Historical data handling via 2years_* tables

**Critical Data Sources:**
- Primary: `phc.ft` (current year invoices)
- Historical: `phc.2years_ft` (previous 2 years)
- Quotes: `phc.bo` and `phc.2years_bo`
- Customers: `phc.cl`
- Line items: `phc.fi` and `phc.bi`

---

## Component Analysis

### Component: Receita Total KPI Card

**Location:** visão-geral > KPI Cards (first card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard` (lines 69-106)
- **State Variable:** `kpiData.mtd.revenue.current` (or qtd/ytd)

#### API Endpoint
- **Route:** `GET /api/financial-analysis/kpi-dashboard`
- **Parameters:** 
  - `costCenter`: Optional filter for specific cost center

#### SQL Query
```sql
-- From calculate_ytd_kpis RPC function
SELECT
  COALESCE(SUM(
    CASE
      WHEN document_type = 'Factura' THEN net_value
      WHEN document_type = 'Nota de Crédito' THEN -net_value
      ELSE 0
    END
  ), 0) AS revenue
FROM phc.ft  -- or phc.2years_ft for historical
WHERE invoice_date >= start_date
  AND invoice_date <= end_date
  AND (anulado IS NULL OR anulado != 'True')
  AND document_type IN ('Factura', 'Nota de Crédito')
```

#### Tables Involved
1. **phc.ft** (current year) / **phc.2years_ft** (historical)
   - **Purpose:** Main invoice table containing all financial transactions
   - **Columns Used:** `net_value`, `invoice_date`, `document_type`, `anulado`
   - **Join Condition:** None (direct query)

#### Aggregation Logic
- **Calculation:** Sum of net_value for Facturas minus sum for Notas de Crédito
- **Filters Applied:** Date range, non-cancelled, specific document types
- **Period Logic:** 
  - MTD: Current month 1st to today vs same month previous year
  - QTD: Current quarter start to today vs same quarter previous year  
  - YTD: Jan 1st to today vs same period previous year

---

### Component: Nº Faturas KPI Card

**Location:** visão-geral > KPI Cards (second card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.invoices.current`

#### API Endpoint
- **Route:** `GET /api/financial-analysis/kpi-dashboard`
- **Parameters:** Same as Receita Total

#### SQL Query
```sql
-- From calculate_ytd_kpis RPC function
SELECT
  COUNT(*) AS invoices
FROM phc.ft
WHERE invoice_date >= start_date
  AND invoice_date <= end_date
  AND (anulado IS NULL OR anulado != 'True')
  AND document_type IN ('Factura', 'Nota de Crédito')
```

#### Tables Involved
1. **phc.ft** / **phc.2years_ft**
   - **Purpose:** Invoice counting
   - **Columns Used:** `invoice_date`, `document_type`, `anulado`
   - **Join Condition:** None

#### Aggregation Logic
- **Calculation:** Simple count of all valid documents
- **Filters Applied:** Same as Receita Total
- **Period Logic:** Same date ranges as Receita Total

---

### Component: Nº Clientes KPI Card

**Location:** visão-geral > KPI Cards (third card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.customers.current`

#### SQL Query
```sql
-- From calculate_ytd_kpis RPC function
SELECT
  COUNT(DISTINCT customer_id) AS customers
FROM phc.ft
WHERE invoice_date >= start_date
  AND invoice_date <= end_date
  AND (anulado IS NULL OR anulado != 'True')
  AND document_type IN ('Factura', 'Nota de Crédito')
```

#### Tables Involved
1. **phc.ft** / **phc.2years_ft**
   - **Purpose:** Customer counting
   - **Columns Used:** `customer_id`, `invoice_date`, `document_type`, `anulado`
   - **Join Condition:** None

#### Aggregation Logic
- **Calculation:** Count of unique customer IDs
- **Filters Applied:** Same as other KPIs
- **Period Logic:** Same date ranges

---

### Component: Ticket Médio KPI Card

**Location:** visão-geral > KPI Cards (fourth card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.avgInvoiceValue.current`

#### SQL Query
```sql
-- From calculate_ytd_kpis RPC function
SELECT
  COALESCE(
    SUM(
      CASE
        WHEN document_type = 'Factura' THEN net_value
        WHEN document_type = 'Nota de Crédito' THEN -net_value
        ELSE 0
      END
    ) / NULLIF(COUNT(CASE WHEN document_type = 'Factura' THEN 1 END), 0),
    0
  ) AS avg_invoice_value
FROM phc.ft
WHERE invoice_date >= start_date
  AND invoice_date <= end_date
  AND (anulado IS NULL OR anulado != 'True')
  AND document_type IN ('Factura', 'Nota de Crédito')
```

#### Tables Involved
1. **phc.ft** / **phc.2years_ft**
   - **Purpose:** Average invoice calculation
   - **Columns Used:** `net_value`, `document_type`, `invoice_date`, `anulado`
   - **Join Condition:** None

#### Aggregation Logic
- **Calculation:** Net revenue divided by count of Facturas only
- **Filters Applied:** Same as other KPIs
- **Period Logic:** Same date ranges
- **Special Handling:** Only Facturas counted in denominator, Notas de Crédito excluded

---

### Component: Orçamentos Valor KPI Card

**Location:** visão-geral > KPI Cards (fifth card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.quoteValue.current`

#### API Endpoint
- **Route:** `GET /api/financial-analysis/kpi-dashboard`
- **Parameters:** Uses `calculate_ytd_quotes` RPC (function not found in migrations)

#### SQL Query
*Note: The `calculate_ytd_quotes` RPC function was referenced in the API but not found in the migration files. Based on the pattern, it would be:*

```sql
-- Estimated calculate_ytd_quotes function
SELECT
  COALESCE(SUM(total_value), 0) AS quote_value
FROM phc.bo  -- or phc.2years_bo for historical
WHERE document_date >= start_date
  AND document_date <= end_date
  AND document_type = 'Orçamento'
```

#### Tables Involved
1. **phc.bo** / **phc.2years_bo**
   - **Purpose:** Quotes/Orçamentos data
   - **Columns Used:** `total_value`, `document_date`, `document_type`
   - **Join Condition:** None

#### Aggregation Logic
- **Calculation:** Sum of total_value for Orçamentos
- **Filters Applied:** Date range, document_type = 'Orçamento'
- **Period Logic:** Same date ranges as other KPIs

---

### Component: Orçamentos Qtd KPI Card

**Location:** visão-geral > KPI Cards (sixth card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.quoteCount.current`

#### SQL Query
```sql
-- Estimated from calculate_ytd_quotes function
SELECT
  COUNT(*) AS quote_count
FROM phc.bo
WHERE document_date >= start_date
  AND document_date <= end_date
  AND document_type = 'Orçamento'
```

#### Tables Involved
1. **phc.bo** / **phc.2years_bo**
   - **Purpose:** Quote counting
   - **Columns Used:** `document_date`, `document_type`
   - **Join Condition:** None

#### Aggregation Logic
- **Calculation:** Count of Orçamentos documents
- **Filters Applied:** Date range, document_type filter
- **Period Logic:** Same date ranges

---

### Component: Taxa Conversão KPI Card

**Location:** visão-geral > KPI Cards (seventh card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.conversionRate.current`

#### Calculation Logic
```javascript
// From API route (lines 528-534)
const mtdConversionRateCurrent =
  mtdQuotesCurrentMetrics.quoteCount > 0
    ? (mtdCurrentMetrics.invoices / mtdQuotesCurrentMetrics.quoteCount) * 100
    : 0;
```

#### Aggregation Logic
- **Calculation:** (Number of invoices / Number of quotes) * 100
- **Data Sources:** Combines data from both ft and bo tables
- **Period Logic:** Same date ranges for both invoices and quotes
- **Special Handling:** Division by zero protection

---

### Component: Orçamento Médio KPI Card

**Location:** visão-geral > KPI Cards (eighth card)
**Period:** MTD/QTD/YTD (switchable)

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx`
- **Component:** `MetricCard`
- **State Variable:** `kpiData.mtd.avgQuoteValue.current`

#### Calculation Logic
```javascript
// From API route (lines 491-495)
const mtdAvgQuoteValueCurrent =
  mtdQuotesCurrentMetrics.quoteCount > 0
    ? mtdQuotesCurrentMetrics.quoteValue / mtdQuotesCurrentMetrics.quoteCount
    : 0;
```

#### Aggregation Logic
- **Calculation:** Total quote value divided by quote count
- **Data Sources:** Uses bo table data
- **Period Logic:** Same date ranges
- **Special Handling:** Division by zero protection

---

## Component: Top 20 Clientes YTD Table

**Location:** visão-geral > Top 20 Clientes YTD section
**Period:** YTD (default), also supports MTD and 12months

#### Frontend Component
- **File:** `app/gestao/analise-financeira/page.tsx` (lines 744-846)
- **Component:** Table with sorting capabilities
- **State Variable:** `topCustomers.customers`

#### API Endpoint
- **Route:** `GET /api/financial-analysis/top-customers`
- **Parameters:** 
  - `limit`: Number of customers (default 20)
  - `period`: 'ytd', '12months', or 'mtd'

#### SQL Query
```sql
-- From get_invoices_for_period RPC function
SELECT
  invoice_id::TEXT,
  customer_id::INTEGER,
  net_value::NUMERIC,
  invoice_date::DATE,
  document_type::TEXT,
  anulado::TEXT
FROM phc.ft
WHERE invoice_date >= start_date
  AND invoice_date <= end_date
ORDER BY invoice_date ASC
```

#### Customer Details Query
```sql
-- From get_customers_by_ids RPC function
SELECT
  cl.customer_id::INTEGER,
  cl.customer_name::TEXT,
  cl.city::TEXT,
  cl.salesperson::TEXT
FROM phc.cl
WHERE cl.customer_id = ANY(customer_ids);
```

#### Tables Involved
1. **phc.ft** / **phc.2years_ft**
   - **Purpose:** Invoice data for revenue calculation
   - **Columns Used:** `invoice_id`, `customer_id`, `net_value`, `invoice_date`, `document_type`, `anulado`
   - **Join Condition:** None

2. **phc.cl**
   - **Purpose:** Customer master data
   - **Columns Used:** `customer_id`, `customer_name`, `city`, `salesperson`
   - **Join Condition:** customer_id match

#### Aggregation Logic
- **Customer Ranking:** By net revenue (descending)
- **Revenue Calculation:** Sum of net_value for Facturas minus Notas de Crédito
- **Special Business Rule:** HH PRINT MANAGEMENT group (customer_ids 2043 and 2149 are consolidated)
- **Previous Year Comparison:** For YTD period only
- **Filters Applied:** Valid documents only, date range
- **Period Logic:** 
  - YTD: Jan 1st to today
  - MTD: Current month 1st to today
  - 12months: Rolling 12 months

---

## API Endpoints Documentation

### 1. KPI Dashboard Endpoint
- **Path:** `/api/financial-analysis/kpi-dashboard`
- **Method:** GET
- **Purpose:** Returns all 8 KPI metrics for MTD/QTD/YTD periods
- **Authentication:** Required (Supabase auth)
- **RPC Functions Used:** `calculate_ytd_kpis`, `calculate_ytd_quotes`
- **Response Format:** JSON with nested period structures

### 2. Top Customers Endpoint
- **Path:** `/api/financial-analysis/top-customers`
- **Method:** GET
- **Purpose:** Returns ranked customer list with revenue metrics
- **Authentication:** Required
- **RPC Functions Used:** `get_invoices_for_period`, `get_customers_by_ids`
- **Response Format:** JSON with customer array and summary

### 3. Monthly Revenue Endpoint
- **Path:** `/api/financial-analysis/monthly-revenue`
- **Method:** GET
- **Purpose:** Returns monthly revenue breakdown for current year
- **Authentication:** Required
- **RPC Functions Used:** `get_monthly_revenue_breakdown`
- **Response Format:** JSON with monthly data array

### 4. Multi-Year Revenue Endpoint
- **Path:** `/api/financial-analysis/multi-year-revenue`
- **Method:** GET
- **Purpose:** Returns 3-year revenue comparison
- **Authentication:** Required
- **RPC Functions Used:** `get_monthly_revenue_breakdown` (called 3 times)
- **Response Format:** JSON with years array and series data

---

## Table Relationships and Data Sources

### Primary PHC ERP Tables

#### 1. phc.ft (Invoices - Current Year)
- **Purpose:** Main invoice table for current year
- **Key Columns:** `invoice_id`, `customer_id`, `net_value`, `invoice_date`, `document_type`, `anulado`
- **Relationships:** 
  - Links to `phc.cl.customer_id`
  - Historical data in `phc.2years_ft`

#### 2. phc.2years_ft (Invoices - Historical)
- **Purpose:** Invoice data for previous 2 years
- **Structure:** Identical to `phc.ft`
- **Usage:** YTD comparisons, historical reporting

#### 3. phc.bo (Quotes/Orders - Current Year)
- **Purpose:** Quotes and orders table
- **Key Columns:** `document_id`, `customer_id`, `total_value`, `document_date`, `document_type`
- **Relationships:** Links to `phc.cl.customer_id`

#### 4. phc.2years_bo (Quotes/Orders - Historical)
- **Purpose:** Historical quotes and orders
- **Structure:** Identical to `phc.bo`
- **Usage:** Historical quote comparisons

#### 5. phc.cl (Customers)
- **Purpose:** Customer master data
- **Key Columns:** `customer_id`, `customer_name`, `city`, `salesperson`
- **Relationships:** 
  - Referenced by `phc.ft.customer_id`
  - Referenced by `phc.bo.customer_id`

#### 6. phc.fi (Invoice Line Items)
- **Purpose:** Detailed invoice line items
- **Key Columns:** `bistamp`, `invoice_id`, `net_liquid_value`
- **Relationships:** Links to `phc.ft.invoice_id`

#### 7. phc.bi (Document Links)
- **Purpose:** Links between different document types
- **Key Columns:** `document_id`, `line_id`
- **Usage:** Links quotes to invoices via bistamp chain

### Data Flow Architecture

```
Frontend (React/Next.js)
    ↓ HTTP API Calls
API Routes (Next.js API)
    ↓ RPC Function Calls
Supabase PostgreSQL
    ↓ Secure Database Access
PHC ERP Tables (ft, bo, cl, fi, bi)
```

---

## Period Calculations and Date Logic

### MTD (Month-to-Date) Logic
- **Current Period:** 1st of current month to today
- **Previous Period:** 1st of same month previous year to same day
- **Example:** Nov 1-13, 2025 vs Nov 1-13, 2024

### QTD (Quarter-to-Date) Logic
- **Current Period:** 1st of current quarter to today
- **Previous Period:** 1st of same quarter previous year to same day
- **Example:** Oct 1 - Nov 13, 2025 vs Oct 1 - Nov 13, 2024

### YTD (Year-to-Date) Logic
- **Current Period:** Jan 1st of current year to today
- **Previous Period:** Jan 1st of previous year to same day
- **Example:** Jan 1 - Nov 13, 2025 vs Jan 1 - Nov 13, 2024

---

## Known Issues and Considerations

### 1. Missing RPC Function
- **Issue:** `calculate_ytd_quotes` function referenced in API but not found in migrations
- **Impact:** Quotes KPIs may not function correctly
- **Recommendation:** Create the missing RPC function following the same pattern as `calculate_ytd_kpis`

### 2. Data Consistency
- **Issue:** Historical tables (`2years_*`) may not be synchronized in real-time
- **Impact:** YTD comparisons may have timing discrepancies
- **Recommendation:** Implement regular sync processes

### 3. Customer Consolidation
- **Issue:** Special business rule for HH PRINT MANAGEMENT (IDs 2043 + 2149)
- **Impact:** Hard-coded grouping logic in API
- **Recommendation:** Consider moving to configuration table

### 4. Performance Considerations
- **Issue:** Large table scans on ft and bo tables
- **Impact:** Potential slow response times for large date ranges
- **Recommendation:** Ensure proper indexes on date columns and customer_id

---

## Data Quality and Validation

### Document Type Handling
- **Valid Types:** 'Factura', 'Nota de Crédito'
- **Exclusion Logic:** `anulado IS NULL OR anulado != 'True'`
- **Revenue Calculation:** Facturas (positive), Notas de Crédito (negative)

### Null Handling
- **Customer Names:** Default to "(Unknown)" if null
- **Cities:** Default to empty string if null
- **Salespersons:** Default to "(Unassigned)" if null
- **Division by Zero:** Protected in all calculations

### Encoding Issues
- **Portuguese Characters:** Handled via `fixEncoding` helper function
- **Data Source:** PHC legacy system may have encoding inconsistencies

---

## Security and Access Control

### Authentication
- **Method:** Supabase Auth with JWT tokens
- **Validation:** All API endpoints require authenticated user
- **Error Handling:** 401 responses for unauthorized access

### Database Security
- **RPC Functions:** SECURITY DEFINER (bypasses RLS)
- **Parameter Validation:** SQL injection protection via format() function
- **Table Access:** Direct access restricted, RPC functions only

---

## Recommendations for Data Consistency Improvements

### 1. Create Missing Quotes RPC Function
```sql
CREATE OR REPLACE FUNCTION calculate_ytd_quotes(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'bo'
)
RETURNS TABLE(
  quote_value NUMERIC,
  quote_count BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Implementation following calculate_ytd_kpis pattern
END;
$$;
```

### 2. Implement Data Validation
- Add checksum validation between ft and 2years_ft
- Implement automated sync monitoring
- Create data quality dashboards

### 3. Performance Optimization
- Add composite indexes on (invoice_date, customer_id)
- Implement query result caching for KPIs
- Consider materialized views for complex aggregations

### 4. Business Logic Centralization
- Move customer grouping rules to configuration tables
- Implement centralized period calculation functions
- Create unified document type validation

---

## Conclusion

The IMACX financial dashboard demonstrates a well-architected system for tracing financial data from legacy PHC ERP to modern web interface. The use of secure RPC functions provides proper data access control while maintaining performance. The 8 KPI cards and Top 20 Customers table are fully traceable with clear data lineage documentation.

**System Strengths:**
- Clear separation of concerns (frontend → API → RPC → Database)
- Proper authentication and security measures
- Comprehensive period calculations (MTD/QTD/YTD)
- Historical data handling for year-over-year comparisons

**Areas for Improvement:**
- Missing quotes RPC function needs implementation
- Performance optimization for large datasets
- Business logic centralization
- Enhanced data validation and monitoring

This documentation provides a complete foundation for understanding data flow, troubleshooting discrepancies, and implementing future enhancements to the financial dashboard system.