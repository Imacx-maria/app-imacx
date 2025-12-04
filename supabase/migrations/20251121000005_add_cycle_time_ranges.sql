-- Add time range grouping to designer cycle times
-- Created: 2025-11-21
-- Purpose: Group cycle times into predefined ranges (1-2 days, 3-4 days, etc.)

CREATE OR REPLACE FUNCTION get_designer_cycle_times(
  start_date DATE,
  end_date DATE,
  group_by TEXT DEFAULT 'month' -- 'month', 'designer', 'complexity', 'time_range'
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
  IF group_by = 'time_range' THEN
    -- Group by predefined time ranges
    RETURN QUERY
    SELECT
      CASE
        WHEN (di.data_saida - di.data_in) <= 2 THEN '1-2 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 3 AND 4 THEN '3-4 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 5 AND 6 THEN '5-6 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 7 AND 10 THEN '7-10 DIAS'
        ELSE '10+ DIAS'
      END as grouping_key,
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
    GROUP BY
      CASE
        WHEN (di.data_saida - di.data_in) <= 2 THEN '1-2 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 3 AND 4 THEN '3-4 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 5 AND 6 THEN '5-6 DIAS'
        WHEN (di.data_saida - di.data_in) BETWEEN 7 AND 10 THEN '7-10 DIAS'
        ELSE '10+ DIAS'
      END
    ORDER BY
      CASE grouping_key
        WHEN '1-2 DIAS' THEN 1
        WHEN '3-4 DIAS' THEN 2
        WHEN '5-6 DIAS' THEN 3
        WHEN '7-10 DIAS' THEN 4
        WHEN '10+ DIAS' THEN 5
      END;

  ELSIF group_by = 'month' THEN
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
