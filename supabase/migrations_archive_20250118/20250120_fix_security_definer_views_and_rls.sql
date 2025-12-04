-- Migration: Fix Security Definer Views and Enable RLS
-- Date: 2025-01-20
-- Purpose: 
--   1. Recreate views without SECURITY DEFINER (use SECURITY INVOKER instead)
--   2. Enable RLS on all tables that are missing it
--   3. Create appropriate RLS policies

-- ============================================================================
-- PART 1: Fix Security Definer Views
-- ============================================================================
-- Views should use SECURITY INVOKER to respect the querying user's permissions
-- and RLS policies, rather than bypassing them with SECURITY DEFINER

-- Recreate view: public.folhas_obras_with_dias
-- Drop and recreate with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.folhas_obras_with_dias CASCADE;
CREATE VIEW public.folhas_obras_with_dias
WITH (security_invoker = true) AS
SELECT 
    fo.id,
    fo."Numero_do_" AS numero_fo,
    fo.numero_orc,
    fo."Trabalho" AS nome_campanha,
    fo."Data_efeti" AS data_saida,
    fo.prioridade,
    fo."Observacoe" AS notas,
    NULL::boolean AS concluido,
    NULL::boolean AS saiu,
    NULL::boolean AS fatura,
    fo.created_at,
    fo."Nome" AS cliente,
    NULL::text AS id_cliente,
    NULL::timestamp without time zone AS data_concluido,
    fo.updated_at,
    ((COALESCE(fo."Data_efeti", CURRENT_DATE) - (fo.created_at)::date))::numeric AS dias_trabalho
FROM folhas_obras fo;

COMMENT ON VIEW public.folhas_obras_with_dias IS 'View showing folhas de obras with calculated days. Uses SECURITY INVOKER to respect RLS.';

-- Recreate view: public.v_producao_operations_summary
-- Drop and recreate with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.v_producao_operations_summary CASCADE;
CREATE VIEW public.v_producao_operations_summary
WITH (security_invoker = true) AS
SELECT 
    job.id AS job_id,
    job.folha_obra_id,
    job.item_id,
    job."Tipo_Op",
    job.plano_nome,
    job.qt_print_planned,
    job.qt_corte_planned,
    job.print_job_id,
    job.cut_job_id,
    COALESCE(sum(exec.num_placas_print), (0)::numeric) AS total_printed,
    COALESCE(sum(exec.num_placas_corte), (0)::numeric) AS total_cut,
    count(exec.id) AS num_splits,
    CASE
        WHEN (job.qt_print_planned > 0) THEN round(((COALESCE(sum(exec.num_placas_print), (0)::numeric) / (job.qt_print_planned)::numeric) * (100)::numeric), 2)
        WHEN (job.qt_corte_planned > 0) THEN round(((COALESCE(sum(exec.num_placas_corte), (0)::numeric) / (job.qt_corte_planned)::numeric) * (100)::numeric), 2)
        ELSE (0)::numeric
    END AS progress_percent
FROM (producao_operacoes job
    LEFT JOIN producao_operacoes exec ON (
        ((job.print_job_id IS NOT NULL) AND (exec.print_job_id = job.print_job_id) AND (NOT exec.is_source_record)) 
        OR 
        ((job.cut_job_id IS NOT NULL) AND (exec.cut_job_id = job.cut_job_id) AND (NOT exec.is_source_record))
    ))
WHERE (job.is_source_record = true)
GROUP BY job.id, job.folha_obra_id, job.item_id, job."Tipo_Op", job.plano_nome, job.qt_print_planned, job.qt_corte_planned, job.print_job_id, job.cut_job_id;

COMMENT ON VIEW public.v_producao_operations_summary IS 'Summary view showing planned vs executed quantities for production operations. Uses SECURITY INVOKER to respect RLS.';

-- Recreate view: phc.folha_obra_with_orcamento
-- Drop and recreate with explicit SECURITY INVOKER
DROP VIEW IF EXISTS phc.folha_obra_with_orcamento CASCADE;
CREATE VIEW phc.folha_obra_with_orcamento
WITH (security_invoker = true) AS
WITH orcamento_with_lines AS (
    SELECT 
        orc.document_id,
        orc.document_number,
        orc.document_date,
        orc.document_type,
        orc.customer_id,
        orc.total_value,
        count(DISTINCT orc_bi.line_id) AS orcamento_lines
    FROM (phc.bo orc
        LEFT JOIN phc.bi orc_bi ON ((orc.document_id = orc_bi.document_id)))
    WHERE (orc.document_type = 'Orçamento'::text)
    GROUP BY orc.document_id, orc.document_number, orc.document_date, orc.document_type, orc.customer_id, orc.total_value
), matched_orcamento AS (
    SELECT DISTINCT ON (fo_1.document_id) 
        fo_1.document_id,
        orc.document_id AS orcamento_id,
        orc.document_number AS orcamento_number,
        orc.document_date AS orcamento_date,
        orc.total_value AS orcamento_value,
        orc.orcamento_lines,
        abs((orc.document_date - fo_1.document_date)) AS date_diff_days
    FROM (phc.bo fo_1
        LEFT JOIN orcamento_with_lines orc ON (
            (orc.customer_id = fo_1.customer_id) 
            AND (orc.total_value = fo_1.total_value) 
            AND (orc.document_id <> fo_1.document_id)
        ))
    WHERE (fo_1.document_type = 'Folha de Obra'::text)
    ORDER BY fo_1.document_id, (abs((orc.document_date - fo_1.document_date)))
)
SELECT 
    fo.document_id AS folha_obra_id,
    fo.document_number AS folha_obra_number,
    fo.document_date AS folha_obra_date,
    fo.last_delivery_date AS folha_obra_delivery_date,
    fo.customer_id,
    cl.customer_name,
    fo.total_value AS folha_obra_value,
    fo.observacoes,
    fo.nome_trabalho,
    count(DISTINCT bi.line_id) AS folha_obra_lines,
    mo.orcamento_id,
    mo.orcamento_number,
    mo.orcamento_date,
    mo.orcamento_value,
    mo.orcamento_lines,
    CASE
        WHEN ((mo.orcamento_date IS NOT NULL) AND (fo.document_date IS NOT NULL)) THEN (fo.document_date - mo.orcamento_date)
        ELSE NULL::integer
    END AS days_between_quote_and_work,
    CASE
        WHEN ((mo.orcamento_date IS NOT NULL) AND (fo.last_delivery_date IS NOT NULL)) THEN (fo.last_delivery_date - mo.orcamento_date)
        ELSE NULL::integer
    END AS days_between_quote_and_delivery,
    CASE
        WHEN (mo.orcamento_value IS NOT NULL) THEN (fo.total_value - mo.orcamento_value)
        ELSE NULL::numeric
    END AS value_difference
FROM (((phc.bo fo
    LEFT JOIN phc.cl cl ON ((fo.customer_id = cl.customer_id)))
    LEFT JOIN phc.bi bi ON ((fo.document_id = bi.document_id)))
    LEFT JOIN matched_orcamento mo ON ((fo.document_id = mo.document_id)))
WHERE ((fo.document_number IS NOT NULL) AND (fo.document_type = 'Folha de Obra'::text))
GROUP BY fo.document_id, fo.document_number, fo.document_date, fo.last_delivery_date, fo.customer_id, cl.customer_name, fo.total_value, fo.observacoes, fo.nome_trabalho, mo.orcamento_id, mo.orcamento_number, mo.orcamento_date, mo.orcamento_value, mo.orcamento_lines;

COMMENT ON VIEW phc.folha_obra_with_orcamento IS 'View matching folhas de obras with their related orçamentos. Uses SECURITY INVOKER to respect RLS.';

-- Grant permissions on views
GRANT SELECT ON public.folhas_obras_with_dias TO authenticated;
GRANT SELECT ON public.v_producao_operations_summary TO authenticated;
GRANT SELECT ON phc.folha_obra_with_orcamento TO authenticated;

-- ============================================================================
-- PART 2: Enable RLS on Public Schema Tables
-- ============================================================================

-- Enable RLS on public.designer_planos
ALTER TABLE IF EXISTS public.designer_planos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can read designer_planos" ON public.designer_planos;
DROP POLICY IF EXISTS "Authenticated users can manage designer_planos" ON public.designer_planos;

-- Create RLS policies for designer_planos
CREATE POLICY "Authenticated users can read designer_planos"
    ON public.designer_planos
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage designer_planos"
    ON public.designer_planos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Enable RLS on public.quote_embeddings
ALTER TABLE IF EXISTS public.quote_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can read quote_embeddings" ON public.quote_embeddings;
DROP POLICY IF EXISTS "Authenticated users can manage quote_embeddings" ON public.quote_embeddings;

-- Create RLS policies for quote_embeddings
CREATE POLICY "Authenticated users can read quote_embeddings"
    ON public.quote_embeddings
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage quote_embeddings"
    ON public.quote_embeddings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Enable RLS on public.fo_plano_items (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fo_plano_items') THEN
        ALTER TABLE public.fo_plano_items ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Authenticated users can read fo_plano_items" ON public.fo_plano_items;
        DROP POLICY IF EXISTS "Authenticated users can manage fo_plano_items" ON public.fo_plano_items;
        
        CREATE POLICY "Authenticated users can read fo_plano_items"
            ON public.fo_plano_items
            FOR SELECT
            TO authenticated
            USING (true);
        
        CREATE POLICY "Authenticated users can manage fo_plano_items"
            ON public.fo_plano_items
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Enable RLS on public.fo_planos (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fo_planos') THEN
        ALTER TABLE public.fo_planos ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Authenticated users can read fo_planos" ON public.fo_planos;
        DROP POLICY IF EXISTS "Authenticated users can manage fo_planos" ON public.fo_planos;
        
        CREATE POLICY "Authenticated users can read fo_planos"
            ON public.fo_planos
            FOR SELECT
            TO authenticated
            USING (true);
        
        CREATE POLICY "Authenticated users can manage fo_planos"
            ON public.fo_planos
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Enable RLS on public.quote_search_summaries (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quote_search_summaries') THEN
        ALTER TABLE public.quote_search_summaries ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Authenticated users can read quote_search_summaries" ON public.quote_search_summaries;
        DROP POLICY IF EXISTS "Authenticated users can manage quote_search_summaries" ON public.quote_search_summaries;
        
        CREATE POLICY "Authenticated users can read quote_search_summaries"
            ON public.quote_search_summaries
            FOR SELECT
            TO authenticated
            USING (true);
        
        CREATE POLICY "Authenticated users can manage quote_search_summaries"
            ON public.quote_search_summaries
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- PART 3: Enable RLS on PHC Schema Tables
-- ============================================================================
-- PHC tables are ETL-managed and typically read-only for authenticated users
-- We'll create read-only policies for authenticated users

-- Enable RLS on phc.temp_quotes_bo
ALTER TABLE IF EXISTS phc.temp_quotes_bo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read temp_quotes_bo" ON phc.temp_quotes_bo;
DROP POLICY IF EXISTS "Service role can manage temp_quotes_bo" ON phc.temp_quotes_bo;

CREATE POLICY "Authenticated users can read temp_quotes_bo"
    ON phc.temp_quotes_bo
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage temp_quotes_bo"
    ON phc.temp_quotes_bo
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.temp_quotes_bi
ALTER TABLE IF EXISTS phc.temp_quotes_bi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read temp_quotes_bi" ON phc.temp_quotes_bi;
DROP POLICY IF EXISTS "Service role can manage temp_quotes_bi" ON phc.temp_quotes_bi;

CREATE POLICY "Authenticated users can read temp_quotes_bi"
    ON phc.temp_quotes_bi
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage temp_quotes_bi"
    ON phc.temp_quotes_bi
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.fl
ALTER TABLE IF EXISTS phc.fl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fl" ON phc.fl;
DROP POLICY IF EXISTS "Service role can manage fl" ON phc.fl;

CREATE POLICY "Authenticated users can read fl"
    ON phc.fl
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage fl"
    ON phc.fl
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.2years_bo
ALTER TABLE IF EXISTS phc."2years_bo" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read 2years_bo" ON phc."2years_bo";
DROP POLICY IF EXISTS "Service role can manage 2years_bo" ON phc."2years_bo";

CREATE POLICY "Authenticated users can read 2years_bo"
    ON phc."2years_bo"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage 2years_bo"
    ON phc."2years_bo"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.sync_watermarks
ALTER TABLE IF EXISTS phc.sync_watermarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sync_watermarks" ON phc.sync_watermarks;
DROP POLICY IF EXISTS "Service role can manage sync_watermarks" ON phc.sync_watermarks;

CREATE POLICY "Authenticated users can read sync_watermarks"
    ON phc.sync_watermarks
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage sync_watermarks"
    ON phc.sync_watermarks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.2years_fi
ALTER TABLE IF EXISTS phc."2years_fi" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read 2years_fi" ON phc."2years_fi";
DROP POLICY IF EXISTS "Service role can manage 2years_fi" ON phc."2years_fi";

CREATE POLICY "Authenticated users can read 2years_fi"
    ON phc."2years_fi"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage 2years_fi"
    ON phc."2years_fi"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.2years_ft
ALTER TABLE IF EXISTS phc."2years_ft" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read 2years_ft" ON phc."2years_ft";
DROP POLICY IF EXISTS "Service role can manage 2years_ft" ON phc."2years_ft";

CREATE POLICY "Authenticated users can read 2years_ft"
    ON phc."2years_ft"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage 2years_ft"
    ON phc."2years_ft"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.cl
ALTER TABLE IF EXISTS phc.cl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cl" ON phc.cl;
DROP POLICY IF EXISTS "Service role can manage cl" ON phc.cl;

CREATE POLICY "Authenticated users can read cl"
    ON phc.cl
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage cl"
    ON phc.cl
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.bo_backup_20251110
ALTER TABLE IF EXISTS phc.bo_backup_20251110 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read bo_backup_20251110" ON phc.bo_backup_20251110;
DROP POLICY IF EXISTS "Service role can manage bo_backup_20251110" ON phc.bo_backup_20251110;

CREATE POLICY "Authenticated users can read bo_backup_20251110"
    ON phc.bo_backup_20251110
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage bo_backup_20251110"
    ON phc.bo_backup_20251110
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.bi
ALTER TABLE IF EXISTS phc.bi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read bi" ON phc.bi;
DROP POLICY IF EXISTS "Service role can manage bi" ON phc.bi;

CREATE POLICY "Authenticated users can read bi"
    ON phc.bi
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage bi"
    ON phc.bi
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.bo
ALTER TABLE IF EXISTS phc.bo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read bo" ON phc.bo;
DROP POLICY IF EXISTS "Service role can manage bo" ON phc.bo;

CREATE POLICY "Authenticated users can read bo"
    ON phc.bo
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage bo"
    ON phc.bo
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.fo
ALTER TABLE IF EXISTS phc.fo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fo" ON phc.fo;
DROP POLICY IF EXISTS "Service role can manage fo" ON phc.fo;

CREATE POLICY "Authenticated users can read fo"
    ON phc.fo
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage fo"
    ON phc.fo
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.ft
ALTER TABLE IF EXISTS phc.ft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ft" ON phc.ft;
DROP POLICY IF EXISTS "Service role can manage ft" ON phc.ft;

CREATE POLICY "Authenticated users can read ft"
    ON phc.ft
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage ft"
    ON phc.ft
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable RLS on phc.fi
ALTER TABLE IF EXISTS phc.fi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fi" ON phc.fi;
DROP POLICY IF EXISTS "Service role can manage fi" ON phc.fi;

CREATE POLICY "Authenticated users can read fi"
    ON phc.fi
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage fi"
    ON phc.fi
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON VIEW public.folhas_obras_with_dias IS 'Fixed: Now uses SECURITY INVOKER to respect RLS policies';
COMMENT ON VIEW public.v_producao_operations_summary IS 'Fixed: Now uses SECURITY INVOKER to respect RLS policies';
COMMENT ON VIEW phc.folha_obra_with_orcamento IS 'Fixed: Now uses SECURITY INVOKER to respect RLS policies';

