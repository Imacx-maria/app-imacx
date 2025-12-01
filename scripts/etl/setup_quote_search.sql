-- Quote Search Setup SQL
-- Run this in Supabase SQL Editor
-- Updated: Uses phc.temp_quotes_bo and phc.temp_quotes_bi tables

-- 1. Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create indexes for fast text search
CREATE INDEX IF NOT EXISTS idx_temp_quotes_bi_description_trgm
ON phc.temp_quotes_bi USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_temp_quotes_bo_observacoes_trgm
ON phc.temp_quotes_bo USING gin (observacoes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_temp_quotes_bo_nome_trabalho_trgm
ON phc.temp_quotes_bo USING gin (nome_trabalho gin_trgm_ops);

-- 3. Drop existing function
DROP FUNCTION IF EXISTS public.search_quotes_by_keywords(text, int);

-- 4. Create search function
CREATE OR REPLACE FUNCTION public.search_quotes_by_keywords(
  keywords text,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  document_number text,
  document_date date,
  total_value numeric,
  description_preview text,
  qty_lines jsonb,
  keyword_matches int,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  stop_words text[] := ARRAY['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
                              'com', 'para', 'por', 'um', 'uma', 'uns', 'umas', 'ao', 'aos',
                              'a', 'e', 'o', 'as', 'os', 'que', 'cm', 'mm', 'mt', 'm', 'x',
                              'nao', 'quero', 'sem', 'so', 'apenas'];
  significant_keywords text[];
  keyword_count int;
BEGIN
  SELECT array_agg(word) INTO significant_keywords
  FROM (
    SELECT unnest(string_to_array(lower(keywords), ' ')) as word
  ) words
  WHERE length(word) > 2
    AND word NOT IN (SELECT unnest(stop_words))
    AND word !~ '^[0-9]+$';

  keyword_count := COALESCE(array_length(significant_keywords, 1), 0);

  IF keyword_count = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH quote_texts AS (
    SELECT
      bo.document_id,
      bo.document_number,
      bo.document_date,
      bo.total_value,
      COALESCE(bo.nome_trabalho, '') || ' ' || COALESCE(bo.observacoes, '') || ' ' ||
      STRING_AGG(COALESCE(bi.description, ''), ' ') as full_text
    FROM phc.temp_quotes_bo bo
    LEFT JOIN phc.temp_quotes_bi bi ON bo.document_id = bi.document_id
    GROUP BY bo.document_id, bo.document_number, bo.document_date, bo.total_value,
             bo.nome_trabalho, bo.observacoes
  ),
  scored_quotes AS (
    SELECT
      qt.document_id,
      qt.document_number,
      qt.document_date,
      qt.total_value,
      LEFT(qt.full_text, 500) as description_preview,
      (
        SELECT COUNT(*)::int
        FROM unnest(significant_keywords) kw
        WHERE lower(qt.full_text) LIKE '%' || kw || '%'
      ) as matched_keywords,
      similarity(qt.full_text, keywords)::float as sim
    FROM quote_texts qt
    WHERE qt.full_text IS NOT NULL
  ),
  filtered_quotes AS (
    SELECT
      sq.document_id,
      sq.document_number,
      sq.document_date,
      sq.total_value,
      sq.description_preview,
      sq.matched_keywords,
      sq.sim
    FROM scored_quotes sq
    WHERE sq.matched_keywords >= GREATEST(1, keyword_count / 2)
       OR sq.sim > 0.2
  )
  SELECT
    fq.document_number,
    fq.document_date,
    fq.total_value,
    fq.description_preview,
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'qty', bi.quantity,
          'total', bi.line_total,
          'unit_price', COALESCE(
            NULLIF(bi.unit_price, 0),
            CASE WHEN bi.quantity > 0 THEN ROUND(bi.line_total / bi.quantity, 2) ELSE NULL END
          ),
          'description', bi.description
        )
        ORDER BY bi.line_order, bi.line_number
      ), '[]'::jsonb)
      FROM phc.temp_quotes_bi bi
      WHERE bi.document_id = fq.document_id
        AND bi.quantity IS NOT NULL
        AND bi.quantity > 0
    ) as qty_lines,
    fq.matched_keywords as keyword_matches,
    fq.sim as similarity
  FROM filtered_quotes fq
  ORDER BY fq.sim DESC, fq.total_value DESC
  LIMIT match_count;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.search_quotes_by_keywords(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_quotes_by_keywords(text, int) TO anon;
