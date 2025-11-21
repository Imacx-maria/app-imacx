-- Production Analytics RPC Functions
-- Created: 2025-11-21
-- Purpose: Provide efficient data aggregation for production performance analytics

-- ============================================================================
-- 1. PRODUCTION KPIs
-- ============================================================================

-- Get overall production KPIs
CREATE OR REPLACE FUNCTION get_production_kpis(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  total_jobs INTEGER,
  completed_jobs INTEGER,
  completion_rate NUMERIC,
  avg_cycle_days NUMERIC,
  total_value_completed NUMERIC,
  jobs_without_logistics INTEGER,
  jobs_without_value INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH job_completion AS (
    SELECT
      fo.id,
      COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
      fo."Euro__tota" as job_value,
      COUNT(DISTINCT ib.id) as total_items,
      COUNT(DISTINCT CASE WHEN le.data_saida IS NOT NULL THEN le.item_id END) as completed_items,
      MAX(le.data_saida)::DATE as completion_date
    FROM folhas_obras fo
    LEFT JOIN items_base ib ON ib.folha_obra_id = fo.id
    LEFT JOIN logistica_entregas le ON le.item_id = ib.id
    WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
      AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
    GROUP BY fo.id, fo.data_in, fo.created_at, fo."Euro__tota"
  )
  SELECT
    COUNT(*)::INTEGER as total_jobs,
    COUNT(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN 1
    END)::INTEGER as completed_jobs,
    ROUND((COUNT(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN 1
    END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) as completion_rate,
    ROUND(AVG(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN completion_date - entry_date
    END), 2)::NUMERIC as avg_cycle_days,
    SUM(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN job_value
      ELSE 0
    END)::NUMERIC as total_value_completed,
    COUNT(CASE WHEN total_items = 0 THEN 1 END)::INTEGER as jobs_without_logistics,
    COUNT(CASE WHEN COALESCE(job_value, 0) = 0 THEN 1 END)::INTEGER as jobs_without_value
  FROM job_completion;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. CYCLE TIME ANALYSIS
-- ============================================================================

-- Get production cycle times grouped by various dimensions
CREATE OR REPLACE FUNCTION get_production_cycle_times(
  start_date DATE,
  end_date DATE,
  group_by TEXT DEFAULT 'time_range' -- 'time_range', 'complexity', 'value_bracket'
)
RETURNS TABLE (
  grouping_key TEXT,
  avg_days NUMERIC,
  job_count INTEGER,
  min_days INTEGER,
  max_days INTEGER,
  total_value NUMERIC
) AS $$
BEGIN
  IF group_by = 'time_range' THEN
    -- Group by predefined time ranges
    RETURN QUERY
    WITH completed_items AS (
      SELECT DISTINCT
        ib.id as item_id,
        COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
        le.data_saida::DATE as completion_date,
        le.data_saida::DATE - COALESCE(fo.data_in::DATE, fo.created_at::DATE) as days_to_complete,
        fo."Euro__tota" / NULLIF(COUNT(DISTINCT ib.id) OVER (PARTITION BY fo.id), 0) as item_value
      FROM folhas_obras fo
      INNER JOIN items_base ib ON ib.folha_obra_id = fo.id
      INNER JOIN logistica_entregas le ON le.item_id = ib.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND le.data_saida IS NOT NULL
    ),
    grouped_data AS (
      SELECT
        CASE
          WHEN days_to_complete <= 7 THEN '1-7 DIAS'
          WHEN days_to_complete BETWEEN 8 AND 14 THEN '8-14 DIAS'
          WHEN days_to_complete BETWEEN 15 AND 30 THEN '15-30 DIAS'
          WHEN days_to_complete BETWEEN 31 AND 60 THEN '31-60 DIAS'
          ELSE '60+ DIAS'
        END as grouping_key,
        ROUND(AVG(days_to_complete), 2)::NUMERIC as avg_days,
        COUNT(*)::INTEGER as job_count,
        MIN(days_to_complete)::INTEGER as min_days,
        MAX(days_to_complete)::INTEGER as max_days,
        SUM(item_value)::NUMERIC as total_value
      FROM completed_items
      WHERE days_to_complete IS NOT NULL
      GROUP BY
        CASE
          WHEN days_to_complete <= 7 THEN '1-7 DIAS'
          WHEN days_to_complete BETWEEN 8 AND 14 THEN '8-14 DIAS'
          WHEN days_to_complete BETWEEN 15 AND 30 THEN '15-30 DIAS'
          WHEN days_to_complete BETWEEN 31 AND 60 THEN '31-60 DIAS'
          ELSE '60+ DIAS'
        END
    )
    SELECT
      grouping_key,
      avg_days,
      job_count,
      min_days,
      max_days,
      total_value
    FROM grouped_data
    ORDER BY
      CASE grouping_key
        WHEN '1-7 DIAS' THEN 1
        WHEN '8-14 DIAS' THEN 2
        WHEN '15-30 DIAS' THEN 3
        WHEN '31-60 DIAS' THEN 4
        WHEN '60+ DIAS' THEN 5
      END;

  ELSIF group_by = 'complexity' THEN
    -- Group by item complexity (not job)
    RETURN QUERY
    WITH completed_items AS (
      SELECT
        ib.id as item_id,
        COALESCE(UPPER(di.complexidade), 'SEM COMPLEXIDADE') as complexidade,
        COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
        le.data_saida::DATE as completion_date,
        le.data_saida::DATE - COALESCE(fo.data_in::DATE, fo.created_at::DATE) as days_to_complete,
        fo."Euro__tota" as job_value
      FROM folhas_obras fo
      INNER JOIN items_base ib ON ib.folha_obra_id = fo.id
      LEFT JOIN designer_items di ON di.item_id = ib.id
      INNER JOIN logistica_entregas le ON le.item_id = ib.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND le.data_saida IS NOT NULL
    )
    SELECT
      complexidade as grouping_key,
      ROUND(AVG(days_to_complete), 2)::NUMERIC,
      COUNT(DISTINCT item_id)::INTEGER,
      MIN(days_to_complete)::INTEGER,
      MAX(days_to_complete)::INTEGER,
      SUM(DISTINCT job_value)::NUMERIC
    FROM completed_items
    GROUP BY complexidade
    ORDER BY
      CASE complexidade
        WHEN 'STANDARD' THEN 1
        WHEN 'ESPECIAL' THEN 2
        WHEN 'VINIL' THEN 3
        WHEN 'PROTÓTIPO' THEN 4
        WHEN 'EXPOSITOR REPETIÇÃO' THEN 5
        WHEN 'EXPOSITOR NOVO' THEN 6
        WHEN 'OFFSET' THEN 7
        ELSE 999
      END;

  ELSIF group_by = 'value_bracket' THEN
    -- Group by value brackets
    RETURN QUERY
    WITH completed_jobs AS (
      SELECT
        fo.id,
        COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
        MAX(le.data_concluido)::DATE as completion_date,
        MAX(le.data_concluido)::DATE - COALESCE(fo.data_in::DATE, fo.created_at::DATE) as days_to_complete,
        COALESCE(fo."Euro__tota", 0) as job_value
      FROM folhas_obras fo
      INNER JOIN items_base ib ON ib.folha_obra_id = fo.id
      INNER JOIN logistica_entregas le ON le.item_id = ib.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND le.concluido = true
      GROUP BY fo.id, fo.data_in, fo.created_at, fo."Euro__tota"
      HAVING COUNT(DISTINCT ib.id) = COUNT(DISTINCT CASE WHEN le.concluido = true THEN le.item_id END)
    )
    SELECT
      CASE
        WHEN job_value = 0 THEN '0 - SEM VALOR'
        WHEN job_value <= 1000 THEN '0-1K'
        WHEN job_value <= 5000 THEN '1K-5K'
        WHEN job_value <= 10000 THEN '5K-10K'
        WHEN job_value <= 25000 THEN '10K-25K'
        ELSE '25K+'
      END as grouping_key,
      ROUND(AVG(days_to_complete), 2)::NUMERIC,
      COUNT(*)::INTEGER,
      MIN(days_to_complete)::INTEGER,
      MAX(days_to_complete)::INTEGER,
      SUM(job_value)::NUMERIC
    FROM completed_jobs
    GROUP BY
      CASE
        WHEN job_value = 0 THEN '0 - SEM VALOR'
        WHEN job_value <= 1000 THEN '0-1K'
        WHEN job_value <= 5000 THEN '1K-5K'
        WHEN job_value <= 10000 THEN '5K-10K'
        WHEN job_value <= 25000 THEN '10K-25K'
        ELSE '25K+'
      END
    ORDER BY
      CASE grouping_key
        WHEN '0 - SEM VALOR' THEN 0
        WHEN '0-1K' THEN 1
        WHEN '1K-5K' THEN 2
        WHEN '5K-10K' THEN 3
        WHEN '10K-25K' THEN 4
        WHEN '25K+' THEN 5
      END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. COMPLEXITY DISTRIBUTION
-- ============================================================================

-- Get job/item distribution by complexity
CREATE OR REPLACE FUNCTION get_production_complexity_distribution(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  complexidade TEXT,
  job_count INTEGER,
  item_count INTEGER,
  avg_completion_days NUMERIC,
  total_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH job_complexity AS (
    SELECT
      COALESCE(UPPER(di.complexidade), 'SEM COMPLEXIDADE') as complexity,
      fo.id as job_id,
      ib.id as item_id,
      COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
      le.data_concluido::DATE as completion_date,
      fo."Euro__tota"
    FROM folhas_obras fo
    INNER JOIN items_base ib ON ib.folha_obra_id = fo.id
    LEFT JOIN designer_items di ON di.item_id = ib.id
    LEFT JOIN logistica_entregas le ON le.item_id = ib.id AND le.concluido = true
    WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
      AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
  )
  SELECT
    complexity,
    COUNT(DISTINCT job_id)::INTEGER,
    COUNT(DISTINCT item_id)::INTEGER,
    ROUND(AVG(CASE
      WHEN completion_date IS NOT NULL
      THEN completion_date - entry_date
    END), 2)::NUMERIC,
    SUM(DISTINCT "Euro__tota")::NUMERIC
  FROM job_complexity
  GROUP BY complexity
  ORDER BY
    CASE complexity
      WHEN 'STANDARD' THEN 1
      WHEN 'ESPECIAL' THEN 2
      WHEN 'VINIL' THEN 3
      WHEN 'PROTÓTIPO' THEN 4
      WHEN 'EXPOSITOR REPETIÇÃO' THEN 5
      WHEN 'EXPOSITOR NOVO' THEN 6
      WHEN 'OFFSET' THEN 7
      ELSE 999
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. VALUE DISTRIBUTION
-- ============================================================================

-- Get job distribution by value brackets
CREATE OR REPLACE FUNCTION get_production_value_distribution(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  job_count INTEGER,
  avg_completion_days NUMERIC,
  total_value NUMERIC,
  completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH job_values AS (
    SELECT
      fo.id,
      COALESCE(fo."Euro__tota", 0) as job_value,
      COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
      COUNT(DISTINCT ib.id) as total_items,
      COUNT(DISTINCT CASE WHEN le.concluido = true THEN le.item_id END) as completed_items,
      MAX(le.data_concluido)::DATE as completion_date
    FROM folhas_obras fo
    LEFT JOIN items_base ib ON ib.folha_obra_id = fo.id
    LEFT JOIN logistica_entregas le ON le.item_id = ib.id
    WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
      AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
    GROUP BY fo.id, fo."Euro__tota", fo.data_in, fo.created_at
  )
  SELECT
    CASE
      WHEN job_value = 0 THEN '0 - SEM VALOR'
      WHEN job_value <= 1000 THEN '0-1K'
      WHEN job_value <= 5000 THEN '1K-5K'
      WHEN job_value <= 10000 THEN '5K-10K'
      WHEN job_value <= 25000 THEN '10K-25K'
      ELSE '25K+'
    END as value_bracket,
    COUNT(*)::INTEGER,
    ROUND(AVG(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN completion_date - entry_date
    END), 2)::NUMERIC,
    SUM(job_value)::NUMERIC,
    ROUND((COUNT(CASE
      WHEN total_items > 0 AND total_items = completed_items
      THEN 1
    END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2)
  FROM job_values
  GROUP BY
    CASE
      WHEN job_value = 0 THEN '0 - SEM VALOR'
      WHEN job_value <= 1000 THEN '0-1K'
      WHEN job_value <= 5000 THEN '1K-5K'
      WHEN job_value <= 10000 THEN '5K-10K'
      WHEN job_value <= 25000 THEN '10K-25K'
      ELSE '25K+'
    END
  ORDER BY
    CASE value_bracket
      WHEN '0 - SEM VALOR' THEN 0
      WHEN '0-1K' THEN 1
      WHEN '1K-5K' THEN 2
      WHEN '5K-10K' THEN 3
      WHEN '10K-25K' THEN 4
      WHEN '25K+' THEN 5
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. DESIGNER LEAD TIME
-- ============================================================================

-- Get average time from job entry to first maquete
CREATE OR REPLACE FUNCTION get_production_designer_lead_time(
  start_date DATE,
  end_date DATE,
  group_by TEXT DEFAULT 'overall' -- 'overall', 'complexity', 'value_bracket'
)
RETURNS TABLE (
  grouping_key TEXT,
  avg_days_to_first_mockup NUMERIC,
  job_count INTEGER,
  min_days INTEGER,
  max_days INTEGER
) AS $$
BEGIN
  IF group_by = 'overall' THEN
    RETURN QUERY
    WITH designer_lead AS (
      SELECT
        EXTRACT(DAY FROM (di.data_maquete_enviada1 - COALESCE(fo.data_in, fo.created_at)))::INTEGER as days_to_mockup
      FROM designer_items di
      INNER JOIN items_base ib ON di.item_id = ib.id
      INNER JOIN folhas_obras fo ON ib.folha_obra_id = fo.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND di.data_maquete_enviada1 IS NOT NULL
        AND COALESCE(fo.data_in, fo.created_at) IS NOT NULL
    )
    SELECT
      'GERAL'::TEXT,
      ROUND(AVG(days_to_mockup), 2)::NUMERIC,
      COUNT(*)::INTEGER,
      MIN(days_to_mockup)::INTEGER,
      MAX(days_to_mockup)::INTEGER
    FROM designer_lead;

  ELSIF group_by = 'complexity' THEN
    RETURN QUERY
    WITH designer_lead AS (
      SELECT
        COALESCE(UPPER(di.complexidade), 'SEM COMPLEXIDADE') as complexity,
        EXTRACT(DAY FROM (di.data_maquete_enviada1 - COALESCE(fo.data_in, fo.created_at)))::INTEGER as days_to_mockup
      FROM designer_items di
      INNER JOIN items_base ib ON di.item_id = ib.id
      INNER JOIN folhas_obras fo ON ib.folha_obra_id = fo.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND di.data_maquete_enviada1 IS NOT NULL
        AND COALESCE(fo.data_in, fo.created_at) IS NOT NULL
    )
    SELECT
      complexity,
      ROUND(AVG(days_to_mockup), 2)::NUMERIC,
      COUNT(*)::INTEGER,
      MIN(days_to_mockup)::INTEGER,
      MAX(days_to_mockup)::INTEGER
    FROM designer_lead
    GROUP BY complexity
    ORDER BY
      CASE complexity
        WHEN 'STANDARD' THEN 1
        WHEN 'ESPECIAL' THEN 2
        WHEN 'VINIL' THEN 3
        WHEN 'PROTÓTIPO' THEN 4
        WHEN 'EXPOSITOR REPETIÇÃO' THEN 5
        WHEN 'EXPOSITOR NOVO' THEN 6
        WHEN 'OFFSET' THEN 7
        ELSE 999
      END;

  ELSIF group_by = 'value_bracket' THEN
    RETURN QUERY
    WITH designer_lead AS (
      SELECT
        COALESCE(fo."Euro__tota", 0) as job_value,
        EXTRACT(DAY FROM (di.data_maquete_enviada1 - COALESCE(fo.data_in, fo.created_at)))::INTEGER as days_to_mockup
      FROM designer_items di
      INNER JOIN items_base ib ON di.item_id = ib.id
      INNER JOIN folhas_obras fo ON ib.folha_obra_id = fo.id
      WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) >= start_date
        AND COALESCE(fo.data_in::DATE, fo.created_at::DATE) <= end_date
        AND di.data_maquete_enviada1 IS NOT NULL
        AND COALESCE(fo.data_in, fo.created_at) IS NOT NULL
    )
    SELECT
      CASE
        WHEN job_value = 0 THEN '0 - SEM VALOR'
        WHEN job_value <= 1000 THEN '0-1K'
        WHEN job_value <= 5000 THEN '1K-5K'
        WHEN job_value <= 10000 THEN '5K-10K'
        WHEN job_value <= 25000 THEN '10K-25K'
        ELSE '25K+'
      END as value_bracket,
      ROUND(AVG(days_to_mockup), 2)::NUMERIC,
      COUNT(*)::INTEGER,
      MIN(days_to_mockup)::INTEGER,
      MAX(days_to_mockup)::INTEGER
    FROM designer_lead
    GROUP BY
      CASE
        WHEN job_value = 0 THEN '0 - SEM VALOR'
        WHEN job_value <= 1000 THEN '0-1K'
        WHEN job_value <= 5000 THEN '1K-5K'
        WHEN job_value <= 10000 THEN '5K-10K'
        WHEN job_value <= 25000 THEN '10K-25K'
        ELSE '25K+'
      END
    ORDER BY
      CASE value_bracket
        WHEN '0 - SEM VALOR' THEN 0
        WHEN '0-1K' THEN 1
        WHEN '1K-5K' THEN 2
        WHEN '5K-10K' THEN 3
        WHEN '10K-25K' THEN 4
        WHEN '25K+' THEN 5
      END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. BOTTLENECK IDENTIFICATION
-- ============================================================================

-- Get jobs stuck in production (>N days without completion)
CREATE OR REPLACE FUNCTION get_production_bottlenecks(
  days_threshold INTEGER DEFAULT 30
)
RETURNS TABLE (
  job_id UUID,
  numero_fo TEXT,
  numero_orc TEXT,
  nome_campanha TEXT,
  cliente TEXT,
  days_in_production INTEGER,
  job_value NUMERIC,
  has_logistics BOOLEAN,
  total_items INTEGER,
  completed_items INTEGER,
  missing_data TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH job_status AS (
    SELECT
      fo.id,
      fo."Numero_do_",
      fo.numero_orc,
      fo."Trabalho",
      fo."Nome",
      CURRENT_DATE - COALESCE(fo.data_in::DATE, fo.created_at::DATE) as days_stuck,
      COALESCE(fo."Euro__tota", 0) as value,
      COUNT(DISTINCT ib.id) as items,
      COUNT(DISTINCT le.id) as logistics_count,
      COUNT(DISTINCT CASE WHEN le.concluido = true THEN le.item_id END) as completed
    FROM folhas_obras fo
    LEFT JOIN items_base ib ON ib.folha_obra_id = fo.id
    LEFT JOIN logistica_entregas le ON le.item_id = ib.id
    WHERE COALESCE(fo.data_in::DATE, fo.created_at::DATE) < CURRENT_DATE - days_threshold
    GROUP BY fo.id, fo."Numero_do_", fo.numero_orc, fo."Trabalho", fo."Nome", fo.data_in, fo.created_at, fo."Euro__tota"
    HAVING COUNT(DISTINCT ib.id) = 0 OR COUNT(DISTINCT ib.id) != COUNT(DISTINCT CASE WHEN le.concluido = true THEN le.item_id END)
  )
  SELECT
    js.id,
    js."Numero_do_",
    js.numero_orc,
    js."Trabalho",
    js."Nome",
    js.days_stuck::INTEGER,
    js.value,
    (js.logistics_count > 0)::BOOLEAN,
    js.items::INTEGER,
    js.completed::INTEGER,
    CASE
      WHEN js.items = 0 THEN 'Sem itens'
      WHEN js.logistics_count = 0 THEN 'Sem logística'
      WHEN js.value = 0 THEN 'Sem valor'
      ELSE 'Em produção'
    END
  FROM job_status js
  ORDER BY js.days_stuck DESC, js.value DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Ensure required indexes exist
-- Note: Using separate indexes instead of COALESCE to avoid IMMUTABLE issues
CREATE INDEX IF NOT EXISTS idx_folhas_obras_data_in ON folhas_obras(data_in) WHERE data_in IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folhas_obras_created_at ON folhas_obras(created_at) WHERE created_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logistica_entregas_concluido ON logistica_entregas(concluido, data_concluido);
CREATE INDEX IF NOT EXISTS idx_items_base_complexity ON items_base(complexidade);
CREATE INDEX IF NOT EXISTS idx_designer_items_maquete1 ON designer_items(data_maquete_enviada1) WHERE data_maquete_enviada1 IS NOT NULL;
