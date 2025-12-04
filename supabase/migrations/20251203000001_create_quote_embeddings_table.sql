-- Migration: Ensure quote_embeddings table exists
-- Date: 2025-12-03
-- Purpose: Create the quote_embeddings table that was missing

-- Step 1: Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create separate embeddings table
CREATE TABLE IF NOT EXISTS quote_embeddings (
    id SERIAL PRIMARY KEY,
    document_number TEXT NOT NULL,
    description TEXT NOT NULL,
    description_embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_number, description)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_embeddings_vector
ON quote_embeddings
USING hnsw (description_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_quote_embeddings_doc_num
ON quote_embeddings(document_number);

-- Step 4: Grant permissions
GRANT SELECT, INSERT, UPDATE ON quote_embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quote_embeddings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE quote_embeddings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE quote_embeddings_id_seq TO service_role;

-- Add comments
COMMENT ON TABLE quote_embeddings IS 'Stores OpenAI embeddings for quote descriptions, separate from ETL-managed temp_quotes_bi';
COMMENT ON COLUMN quote_embeddings.description_embedding IS 'OpenAI text-embedding-3-small vector (1536 dims) for semantic search';
