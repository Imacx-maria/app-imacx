-- Fix 2years_bo and 2years_ft table structures
-- These tables should be exact replicas of bo and ft tables respectively
-- The issue: 2years_ft may have been created with wrong column names

-- Drop and recreate 2years_bo table
DROP TABLE IF EXISTS phc."2years_bo" CASCADE;
CREATE TABLE phc."2years_bo" (
    "document_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_type" TEXT,
    "customer_id" INTEGER,
    "document_date" DATE,
    "observacoes" TEXT,
    "nome_trabalho" TEXT,
    "origin" TEXT,
    "total_value" NUMERIC,
    "last_delivery_date" DATE,
    PRIMARY KEY ("document_id")
);

-- Drop and recreate 2years_ft table with correct structure (anulado, not is_cancelled)
DROP TABLE IF EXISTS phc."2years_ft" CASCADE;
CREATE TABLE phc."2years_ft" (
    "invoice_id" TEXT NOT NULL,
    "invoice_number" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "invoice_date" DATE,
    "document_type" TEXT,
    "net_value" NUMERIC,
    "anulado" TEXT,
    PRIMARY KEY ("invoice_id")
);

-- Grant permissions
GRANT SELECT ON phc."2years_bo" TO authenticated;
GRANT SELECT ON phc."2years_bo" TO anon;
GRANT SELECT ON phc."2years_ft" TO authenticated;
GRANT SELECT ON phc."2years_ft" TO anon;

-- Add comments for documentation
COMMENT ON TABLE phc."2years_bo" IS 'Historical BO data: Last 2 complete years. Synced annually by run_annual_historical.py. Structure matches phc.bo table.';
COMMENT ON TABLE phc."2years_ft" IS 'Historical FT data: Last 2 complete years. Synced annually by run_annual_historical.py. Structure matches phc.ft table with anulado column.';

