-- Add indexes to improve get_department_rankings_ytd() performance
-- These indexes target the most expensive operations in the RPC function

-- =====================================================
-- INDEXES FOR phc.ft (Current Year Invoices)
-- =====================================================

-- Composite index for filtering by year + document type
CREATE INDEX IF NOT EXISTS idx_ft_invoice_date_year_doctype 
ON phc.ft (EXTRACT(YEAR FROM invoice_date), document_type)
WHERE document_type IN ('Factura', 'Nota de Crédito');

-- Index for customer joins
CREATE INDEX IF NOT EXISTS idx_ft_customer_id 
ON phc.ft (customer_id)
WHERE customer_id IS NOT NULL;

-- Composite index for invoice_date + customer_id (for conversion rate calculation)
CREATE INDEX IF NOT EXISTS idx_ft_date_customer 
ON phc.ft (invoice_date, customer_id)
WHERE document_type IN ('Factura', 'Nota de Crédito');

-- =====================================================
-- INDEXES FOR phc.2years_ft (Historical Invoices)
-- =====================================================

-- Composite index for filtering by year + document type
CREATE INDEX IF NOT EXISTS idx_2years_ft_invoice_date_year_doctype 
ON phc."2years_ft" (EXTRACT(YEAR FROM invoice_date), document_type)
WHERE document_type IN ('Factura', 'Nota de Crédito');

-- Index for customer joins
CREATE INDEX IF NOT EXISTS idx_2years_ft_customer_id 
ON phc."2years_ft" (customer_id)
WHERE customer_id IS NOT NULL;

-- Composite index for invoice_date + customer_id
CREATE INDEX IF NOT EXISTS idx_2years_ft_date_customer 
ON phc."2years_ft" (invoice_date, customer_id)
WHERE document_type IN ('Factura', 'Nota de Crédito');

-- =====================================================
-- INDEXES FOR phc.bo (Current Year Quotes)
-- =====================================================

-- Composite index for filtering by year + document type
CREATE INDEX IF NOT EXISTS idx_bo_document_date_year_doctype 
ON phc.bo (EXTRACT(YEAR FROM document_date), document_type)
WHERE document_type = 'Orçamento';

-- Index for customer joins
CREATE INDEX IF NOT EXISTS idx_bo_customer_id 
ON phc.bo (customer_id)
WHERE customer_id IS NOT NULL;

-- Composite index for document_date + customer_id
CREATE INDEX IF NOT EXISTS idx_bo_date_customer 
ON phc.bo (document_date, customer_id)
WHERE document_type = 'Orçamento';

-- =====================================================
-- INDEXES FOR phc.2years_bo (Historical Quotes)
-- =====================================================

-- Composite index for filtering by year + document type
CREATE INDEX IF NOT EXISTS idx_2years_bo_document_date_year_doctype 
ON phc."2years_bo" (EXTRACT(YEAR FROM document_date), document_type)
WHERE document_type = 'Orçamento';

-- Index for customer joins
CREATE INDEX IF NOT EXISTS idx_2years_bo_customer_id 
ON phc."2years_bo" (customer_id)
WHERE customer_id IS NOT NULL;

-- Composite index for document_date + customer_id
CREATE INDEX IF NOT EXISTS idx_2years_bo_date_customer 
ON phc."2years_bo" (document_date, customer_id)
WHERE document_type = 'Orçamento';

-- =====================================================
-- INDEXES FOR phc.cl (Customers)
-- =====================================================

-- Index for salesperson lookups (used in user_name_mapping join)
CREATE INDEX IF NOT EXISTS idx_cl_salesperson_upper 
ON phc.cl (UPPER(BTRIM(salesperson)))
WHERE salesperson IS NOT NULL;

-- Primary customer_id index (if not already exists)
CREATE INDEX IF NOT EXISTS idx_cl_customer_id 
ON phc.cl (customer_id);

-- =====================================================
-- INDEXES FOR public.user_name_mapping
-- =====================================================

-- Index for initials lookup (used in department joins)
CREATE INDEX IF NOT EXISTS idx_user_name_mapping_initials_upper 
ON public.user_name_mapping (UPPER(BTRIM(initials)))
WHERE active = true AND sales = true;

-- Composite index for active sales users by department
CREATE INDEX IF NOT EXISTS idx_user_name_mapping_dept_active_sales 
ON public.user_name_mapping (department, active, sales)
WHERE active = true AND sales = true;

-- =====================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- =====================================================

ANALYZE phc.ft;
ANALYZE phc."2years_ft";
ANALYZE phc.bo;
ANALYZE phc."2years_bo";
ANALYZE phc.cl;
ANALYZE public.user_name_mapping;

