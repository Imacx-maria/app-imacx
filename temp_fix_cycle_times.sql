CREATE OR REPLACE FUNCTION get_production_cycle_times(
  start_date DATE,
  end_date DATE,
  group_by TEXT DEFAULT 'time_range'
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
      grouped_data.grouping_key,
      grouped_data.avg_days,
      grouped_data.job_count,
      grouped_data.min_days,
      grouped_data.max_days,
      grouped_data.total_value
    FROM grouped_data
    ORDER BY
      CASE grouped_data.grouping_key
        WHEN '1-7 DIAS' THEN 1
        WHEN '8-14 DIAS' THEN 2
        WHEN '15-30 DIAS' THEN 3
        WHEN '31-60 DIAS' THEN 4
        WHEN '60+ DIAS' THEN 5
      END;
  ELSIF group_by = 'complexity' THEN
    RETURN QUERY
    WITH completed_items AS (
      SELECT
        ib.id as item_id,
        COALESCE(UPPER(di.complexidade), 'SEM COMPLEXIDADE') as complexidade,
        COALESCE(fo.data_in::DATE, fo.created_at::DATE) as entry_date,
        le.data_saida::DATE as completion_date,
        le.data_saida::DATE - COALESCE(fo.data_in::DATE, fo.created_at::DATE) as days_to_complete,
        fo."Euro__tota" / NULLIF((SELECT COUNT(DISTINCT id) FROM items_base WHERE folha_obra_id = fo.id), 0) as item_value
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
      ROUND(AVG(days_to_complete), 2)::NUMERIC as avg_days,
      COUNT(*)::INTEGER as job_count,
      MIN(days_to_complete)::INTEGER as min_days,
      MAX(days_to_complete)::INTEGER as max_days,
      SUM(item_value)::NUMERIC as total_value
    FROM completed_items
    WHERE days_to_complete IS NOT NULL
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
  END IF;
END;
$$ LANGUAGE plpgsql;
