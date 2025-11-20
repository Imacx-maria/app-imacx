-- Designer Analytics RPC Functions
-- Created: 2025-11-20
-- Purpose: Provide efficient data aggregation for designer performance analytics

-- ============================================================================
-- 1. COMPLEXITY & DESIGNER DISTRIBUTION
-- ============================================================================

-- Get work distribution by complexity and designer
CREATE OR REPLACE FUNCTION get_designer_complexity_distribution(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  complexidade TEXT,
  designer TEXT,
  item_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(di.complexidade, 'Sem Complexidade') as complexidade,
    COALESCE(di.designer, 'Não Atribuído') as designer,
    COUNT(di.id)::INTEGER as item_count
  FROM designer_items di
  WHERE di.data_in >= start_date
    AND di.data_in <= end_date
  GROUP BY di.complexidade, di.designer
  ORDER BY di.complexidade, di.designer;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. CYCLE TIME ANALYSIS
-- ============================================================================

-- Get average cycle times (entrada -> saida) grouped by month, designer, or complexity
CREATE OR REPLACE FUNCTION get_designer_cycle_times(
  start_date DATE,
  end_date DATE,
  group_by TEXT DEFAULT 'month' -- 'month', 'designer', 'complexity'
)
RETURNS TABLE (
  grouping_key TEXT,
  avg_days_entrada_saida NUMERIC,
  avg_days_entrada_paginacao NUMERIC,
  completed_items INTEGER,
  min_days INTEGER,
  max_days INTEGER
) AS $$
BEGIN
  IF group_by = 'month' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(di.data_saida, 'YYYY-MM') as grouping_key,
      ROUND(AVG(di.data_saida - di.data_in), 2)::NUMERIC as avg_days_entrada_saida,
      ROUND(AVG(CASE
        WHEN di.data_paginacao IS NOT NULL
        THEN di.data_paginacao::DATE - di.data_in
      END), 2)::NUMERIC as avg_days_entrada_paginacao,
      COUNT(*)::INTEGER as completed_items,
      MIN(di.data_saida - di.data_in)::INTEGER as min_days,
      MAX(di.data_saida - di.data_in)::INTEGER as max_days
    FROM designer_items di
    WHERE di.data_saida IS NOT NULL
      AND di.data_in IS NOT NULL
      AND di.data_saida >= start_date
      AND di.data_saida <= end_date
    GROUP BY TO_CHAR(di.data_saida, 'YYYY-MM')
    ORDER BY TO_CHAR(di.data_saida, 'YYYY-MM');

  ELSIF group_by = 'designer' THEN
    RETURN QUERY
    SELECT
      COALESCE(di.designer, 'Não Atribuído') as grouping_key,
      ROUND(AVG(di.data_saida - di.data_in), 2)::NUMERIC as avg_days_entrada_saida,
      ROUND(AVG(CASE
        WHEN di.data_paginacao IS NOT NULL
        THEN di.data_paginacao::DATE - di.data_in
      END), 2)::NUMERIC as avg_days_entrada_paginacao,
      COUNT(*)::INTEGER as completed_items,
      MIN(di.data_saida - di.data_in)::INTEGER as min_days,
      MAX(di.data_saida - di.data_in)::INTEGER as max_days
    FROM designer_items di
    WHERE di.data_saida IS NOT NULL
      AND di.data_in IS NOT NULL
      AND di.data_saida >= start_date
      AND di.data_saida <= end_date
    GROUP BY di.designer
    ORDER BY di.designer;

  ELSIF group_by = 'complexity' THEN
    RETURN QUERY
    SELECT
      COALESCE(di.complexidade, 'Sem Complexidade') as grouping_key,
      ROUND(AVG(di.data_saida - di.data_in), 2)::NUMERIC as avg_days_entrada_saida,
      ROUND(AVG(CASE
        WHEN di.data_paginacao IS NOT NULL
        THEN di.data_paginacao::DATE - di.data_in
      END), 2)::NUMERIC as avg_days_entrada_paginacao,
      COUNT(*)::INTEGER as completed_items,
      MIN(di.data_saida - di.data_in)::INTEGER as min_days,
      MAX(di.data_saida - di.data_in)::INTEGER as max_days
    FROM designer_items di
    WHERE di.data_saida IS NOT NULL
      AND di.data_in IS NOT NULL
      AND di.data_saida >= start_date
      AND di.data_saida <= end_date
    GROUP BY di.complexidade
    ORDER BY di.complexidade;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. APPROVAL CYCLE METRICS
-- ============================================================================

-- Track maquete -> aprovacao cycles (M1->A1 through M6->A6)
CREATE OR REPLACE FUNCTION get_approval_cycle_metrics(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  avg_cycles NUMERIC,
  first_time_approval_rate NUMERIC,
  items_with_1_cycle INTEGER,
  items_with_2_cycles INTEGER,
  items_with_3_cycles INTEGER,
  items_with_4_cycles INTEGER,
  items_with_5_cycles INTEGER,
  items_with_6_cycles INTEGER,
  total_items INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(
      CASE WHEN maquete_enviada1 THEN 1 ELSE 0 END +
      CASE WHEN maquete_enviada2 THEN 1 ELSE 0 END +
      CASE WHEN maquete_enviada3 THEN 1 ELSE 0 END +
      CASE WHEN maquete_enviada4 THEN 1 ELSE 0 END +
      CASE WHEN maquete_enviada5 THEN 1 ELSE 0 END +
      CASE WHEN maquete_enviada6 THEN 1 ELSE 0 END
    ), 2)::NUMERIC as avg_cycles,
    ROUND((COUNT(*) FILTER (WHERE aprovacao_recebida1 = true
                       AND maquete_enviada2 = false)::NUMERIC
     / NULLIF(COUNT(*), 0) * 100), 2) as first_time_approval_rate,
    COUNT(*) FILTER (WHERE maquete_enviada1 = true AND maquete_enviada2 = false)::INTEGER,
    COUNT(*) FILTER (WHERE maquete_enviada2 = true AND maquete_enviada3 = false)::INTEGER,
    COUNT(*) FILTER (WHERE maquete_enviada3 = true AND maquete_enviada4 = false)::INTEGER,
    COUNT(*) FILTER (WHERE maquete_enviada4 = true AND maquete_enviada5 = false)::INTEGER,
    COUNT(*) FILTER (WHERE maquete_enviada5 = true AND maquete_enviada6 = false)::INTEGER,
    COUNT(*) FILTER (WHERE maquete_enviada6 = true)::INTEGER,
    COUNT(*)::INTEGER as total_items
  FROM designer_items
  WHERE data_in >= start_date
    AND data_in <= end_date
    AND maquete_enviada1 = true; -- Only items that started the approval process
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. REVISION TRACKING
-- ============================================================================

-- Get revision metrics (R1-R6)
CREATE OR REPLACE FUNCTION get_revision_metrics(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  total_items INTEGER,
  items_with_revisions INTEGER,
  revision_rate NUMERIC,
  r1_count INTEGER,
  r2_count INTEGER,
  r3_count INTEGER,
  r4_count INTEGER,
  r5_count INTEGER,
  r6_count INTEGER,
  avg_revisions_per_item NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_items,
    COUNT(*) FILTER (WHERE "R1" OR "R2" OR "R3" OR "R4" OR "R5" OR "R6")::INTEGER as items_with_revisions,
    ROUND((COUNT(*) FILTER (WHERE "R1" OR "R2" OR "R3" OR "R4" OR "R5" OR "R6")::NUMERIC
     / NULLIF(COUNT(*), 0) * 100), 2) as revision_rate,
    COUNT(*) FILTER (WHERE "R1")::INTEGER as r1_count,
    COUNT(*) FILTER (WHERE "R2")::INTEGER as r2_count,
    COUNT(*) FILTER (WHERE "R3")::INTEGER as r3_count,
    COUNT(*) FILTER (WHERE "R4")::INTEGER as r4_count,
    COUNT(*) FILTER (WHERE "R5")::INTEGER as r5_count,
    COUNT(*) FILTER (WHERE "R6")::INTEGER as r6_count,
    ROUND(AVG(
      CASE WHEN "R1" THEN 1 ELSE 0 END +
      CASE WHEN "R2" THEN 1 ELSE 0 END +
      CASE WHEN "R3" THEN 1 ELSE 0 END +
      CASE WHEN "R4" THEN 1 ELSE 0 END +
      CASE WHEN "R5" THEN 1 ELSE 0 END +
      CASE WHEN "R6" THEN 1 ELSE 0 END
    ), 2)::NUMERIC as avg_revisions_per_item
  FROM designer_items
  WHERE data_in >= start_date
    AND data_in <= end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. BOTTLENECK IDENTIFICATION
-- ============================================================================

-- Find items stuck in workflow (>N days without progress)
CREATE OR REPLACE FUNCTION get_bottleneck_items(
  days_threshold INTEGER DEFAULT 7
)
RETURNS TABLE (
  designer_item_id UUID,
  numero_fo TEXT,
  nome_campanha TEXT,
  descricao TEXT,
  designer TEXT,
  current_stage TEXT,
  days_in_stage INTEGER,
  complexidade TEXT,
  last_updated DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    di.id as designer_item_id,
    fo."Numero_do_" as numero_fo,
    fo."Trabalho" as nome_campanha,
    ib.descricao,
    COALESCE(di.designer, 'Não Atribuído') as designer,
    di.current_stage,
    (CURRENT_DATE - COALESCE(
      di.data_maquete_enviada6,
      di.data_aprovacao_recebida5,
      di.data_maquete_enviada5,
      di.data_aprovacao_recebida4,
      di.data_maquete_enviada4,
      di.data_aprovacao_recebida3,
      di.data_maquete_enviada3,
      di.data_aprovacao_recebida2,
      di.data_maquete_enviada2,
      di.data_aprovacao_recebida1,
      di.data_maquete_enviada1,
      di.data_duvidas_updated,
      di.data_em_curso,
      di.data_in
    )::DATE)::INTEGER as days_in_stage,
    COALESCE(di.complexidade, 'Sem Complexidade') as complexidade,
    di.updated_at as last_updated
  FROM designer_items di
  INNER JOIN items_base ib ON di.item_id = ib.id
  INNER JOIN folhas_obras fo ON ib.folha_obra_id = fo.id
  WHERE di.paginacao = false
    AND (CURRENT_DATE - COALESCE(
      di.data_maquete_enviada6,
      di.data_aprovacao_recebida5,
      di.data_maquete_enviada5,
      di.data_aprovacao_recebida4,
      di.data_maquete_enviada4,
      di.data_aprovacao_recebida3,
      di.data_maquete_enviada3,
      di.data_aprovacao_recebida2,
      di.data_maquete_enviada2,
      di.data_aprovacao_recebida1,
      di.data_maquete_enviada1,
      di.data_duvidas_updated,
      di.data_em_curso,
      di.data_in
    )::DATE) > days_threshold
  ORDER BY days_in_stage DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. WORKLOAD OVER TIME
-- ============================================================================

-- Get designer workload distribution over time
CREATE OR REPLACE FUNCTION get_designer_workload_over_time(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  month TEXT,
  designer TEXT,
  active_items INTEGER,
  completed_items INTEGER,
  avg_completion_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      DATE_TRUNC('month', start_date),
      DATE_TRUNC('month', end_date),
      '1 month'::INTERVAL
    )::DATE as month
  ),
  designers AS (
    SELECT DISTINCT COALESCE(designer, 'Não Atribuído') as designer
    FROM designer_items
    WHERE data_in >= start_date - INTERVAL '1 year' -- Include designers from past year
  )
  SELECT
    TO_CHAR(m.month, 'YYYY-MM') as month,
    d.designer,
    COUNT(di.id) FILTER (
      WHERE di.data_in <= m.month + INTERVAL '1 month' - INTERVAL '1 day'
      AND (di.data_saida IS NULL OR di.data_saida >= m.month)
    )::INTEGER as active_items,
    COUNT(di.id) FILTER (
      WHERE di.data_saida >= m.month
      AND di.data_saida < m.month + INTERVAL '1 month'
    )::INTEGER as completed_items,
    ROUND(AVG(
      CASE
        WHEN di.data_saida >= m.month
        AND di.data_saida < m.month + INTERVAL '1 month'
        THEN di.data_saida - di.data_in
      END
    ), 2)::NUMERIC as avg_completion_days
  FROM months m
  CROSS JOIN designers d
  LEFT JOIN designer_items di ON COALESCE(di.designer, 'Não Atribuído') = d.designer
  GROUP BY m.month, d.designer
  ORDER BY m.month, d.designer;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. KPI SUMMARY
-- ============================================================================

-- Get overall KPIs for a date range
CREATE OR REPLACE FUNCTION get_designer_kpis(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  total_items INTEGER,
  completed_items INTEGER,
  in_progress_items INTEGER,
  avg_cycle_days NUMERIC,
  first_time_approval_rate NUMERIC,
  revision_rate NUMERIC,
  bottleneck_items INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_items,
    COUNT(*) FILTER (WHERE data_saida IS NOT NULL)::INTEGER as completed_items,
    COUNT(*) FILTER (WHERE data_saida IS NULL AND paginacao = false)::INTEGER as in_progress_items,
    ROUND(AVG(CASE WHEN data_saida IS NOT NULL THEN data_saida - data_in END), 2)::NUMERIC as avg_cycle_days,
    ROUND((COUNT(*) FILTER (WHERE aprovacao_recebida1 = true AND maquete_enviada2 = false)::NUMERIC
     / NULLIF(COUNT(*) FILTER (WHERE maquete_enviada1 = true), 0) * 100), 2) as first_time_approval_rate,
    ROUND((COUNT(*) FILTER (WHERE "R1" OR "R2" OR "R3" OR "R4" OR "R5" OR "R6")::NUMERIC
     / NULLIF(COUNT(*), 0) * 100), 2) as revision_rate,
    COUNT(*) FILTER (
      WHERE paginacao = false
      AND (CURRENT_DATE - COALESCE(
        data_maquete_enviada6,
        data_aprovacao_recebida5,
        data_maquete_enviada5,
        data_aprovacao_recebida4,
        data_maquete_enviada4,
        data_aprovacao_recebida3,
        data_maquete_enviada3,
        data_aprovacao_recebida2,
        data_maquete_enviada2,
        data_aprovacao_recebida1,
        data_maquete_enviada1,
        data_duvidas_updated,
        data_em_curso,
        data_in
      )::DATE) > 7
    )::INTEGER as bottleneck_items
  FROM designer_items
  WHERE data_in >= start_date
    AND data_in <= end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_designer_items_data_in ON designer_items(data_in);
CREATE INDEX IF NOT EXISTS idx_designer_items_data_saida ON designer_items(data_saida);
CREATE INDEX IF NOT EXISTS idx_designer_items_designer ON designer_items(designer);
CREATE INDEX IF NOT EXISTS idx_designer_items_complexidade ON designer_items(complexidade);
CREATE INDEX IF NOT EXISTS idx_designer_items_paginacao ON designer_items(paginacao);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_designer_items_dates_range
  ON designer_items(data_in, data_saida)
  WHERE data_saida IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_designer_items_active
  ON designer_items(paginacao, data_in)
  WHERE paginacao = false;
