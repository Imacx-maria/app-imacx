-- Migration: Fix search_quotes_by_embedding function with proper search_path
-- Date: 2025-12-03
-- Purpose: Fix 500 error in /api/quotes/semantic by adding SET search_path clause
-- Issue: SECURITY DEFINER functions need explicit search_path to find tables

CREATE OR REPLACE FUNCTION search_quotes_by_embedding(
    query_embedding vector(1536),
    match_count INT DEFAULT 20,
    similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    document_number TEXT,
    document_date DATE,
    total_value NUMERIC,
    description_preview TEXT,
    qty_lines JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, phc
AS $$
BEGIN
    RETURN QUERY
    WITH similar_embeddings AS (
        -- Find similar embeddings first
        SELECT DISTINCT ON (qe.document_number)
            qe.document_number,
            (1 - (qe.description_embedding <=> query_embedding))::FLOAT AS similarity
        FROM quote_embeddings qe
        WHERE qe.description_embedding IS NOT NULL
          AND (1 - (qe.description_embedding <=> query_embedding)) >= similarity_threshold
        ORDER BY qe.document_number, qe.description_embedding <=> query_embedding
    ),
    quote_data AS (
        -- Get full quote data by joining BO headers with BI lines
        SELECT
            bo.document_number,
            bo.document_date,
            bo.total_value,
            jsonb_agg(
                jsonb_build_object(
                    'qty', bi.quantity,
                    'total', bi.line_total,
                    'unit_price', COALESCE(
                        NULLIF(bi.unit_price, 0),
                        CASE
                            WHEN bi.quantity > 0 THEN ROUND(bi.line_total / bi.quantity, 2)
                            ELSE NULL
                        END
                    ),
                    'description', bi.description
                )
                ORDER BY bi.line_order, bi.line_number
            ) AS lines,
            STRING_AGG(
                bi.description,
                E'\n' ORDER BY bi.line_order, bi.line_number
            ) AS all_descriptions
        FROM phc.temp_quotes_bo bo
        LEFT JOIN phc.temp_quotes_bi bi ON bo.document_id = bi.document_id
        WHERE bo.document_number IN (SELECT se.document_number FROM similar_embeddings se)
        GROUP BY bo.document_number, bo.document_date, bo.total_value
    )
    SELECT
        qd.document_number,
        qd.document_date,
        qd.total_value,
        LEFT(qd.all_descriptions, 500) AS description_preview,
        COALESCE(qd.lines, '[]'::jsonb) AS qty_lines,
        se.similarity
    FROM quote_data qd
    JOIN similar_embeddings se ON qd.document_number = se.document_number
    ORDER BY se.similarity DESC
    LIMIT match_count;
END;
$$;
