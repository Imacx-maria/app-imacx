-- Migration: Add pgvector support for semantic quote search
-- Date: 2025-12-01
-- Purpose: Enable AI semantic search by storing embeddings in a separate table
-- Note: Using separate table because temp_quotes_bi is ETL-managed and gets recreated

-- Step 1: Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create separate embeddings table
-- This table persists independently of the ETL-managed temp_quotes_bi
CREATE TABLE IF NOT EXISTS quote_embeddings (
    id SERIAL PRIMARY KEY,
    document_number TEXT NOT NULL,
    description TEXT NOT NULL,
    description_embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_number, description)
);

-- Step 3: Create index for fast similarity search
-- Using HNSW index for better performance on similarity queries
CREATE INDEX IF NOT EXISTS idx_quote_embeddings_vector
ON quote_embeddings
USING hnsw (description_embedding vector_cosine_ops);

-- Index for joining with temp_quotes_bi
CREATE INDEX IF NOT EXISTS idx_quote_embeddings_doc_num
ON quote_embeddings(document_number);

-- Step 4: Create function for semantic search
-- Joins embeddings table with temp_quotes_bi for full quote data
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

-- Step 5: Grant permissions
GRANT SELECT, INSERT, UPDATE ON quote_embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quote_embeddings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE quote_embeddings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE quote_embeddings_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION search_quotes_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_quotes_by_embedding TO service_role;

-- Add comments for documentation
COMMENT ON TABLE quote_embeddings IS 'Stores OpenAI embeddings for quote descriptions, separate from ETL-managed temp_quotes_bi';
COMMENT ON COLUMN quote_embeddings.description_embedding IS 'OpenAI text-embedding-3-small vector (1536 dims) for semantic search';
COMMENT ON FUNCTION search_quotes_by_embedding IS 'Semantic search for quotes using cosine similarity on embeddings';
