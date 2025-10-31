-- Migration: Fix phc.bo duplicate records and add business rule constraint
-- Date: 2025-10-31
-- Description: Removes duplicate records in phc.bo table and adds unique constraint
--              to prevent duplicates of (document_number, document_type, year)

-- ==============================================================================
-- STEP 1: Report current duplicates
-- ==============================================================================

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT document_number, document_type, EXTRACT(YEAR FROM document_date) as year
        FROM phc.bo
        GROUP BY document_number, document_type, EXTRACT(YEAR FROM document_date)
        HAVING COUNT(*) > 1
    ) duplicates;

    RAISE NOTICE 'Found % business key combinations with duplicates', duplicate_count;
END $$;

-- ==============================================================================
-- STEP 2: Remove duplicate records (keep first occurrence by ctid)
-- ==============================================================================

-- Delete duplicates, keeping the row with the smallest ctid (first inserted)
DELETE FROM phc.bo
WHERE ctid IN (
    SELECT ctid
    FROM (
        SELECT
            ctid,
            ROW_NUMBER() OVER (
                PARTITION BY document_number, document_type, EXTRACT(YEAR FROM document_date)
                ORDER BY ctid
            ) as rn
        FROM phc.bo
    ) ranked
    WHERE rn > 1
);

-- Report deleted count
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate records', deleted_count;
END $$;

-- ==============================================================================
-- STEP 3: Add unique constraint for business rule
-- ==============================================================================

-- Create unique index on (document_number, document_type, year)
-- Using a functional index since we need EXTRACT(YEAR FROM document_date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bo_unique_business_key
ON phc.bo (
    document_number,
    document_type,
    EXTRACT(YEAR FROM document_date)
);

-- Add comment explaining the constraint
COMMENT ON INDEX phc.idx_bo_unique_business_key IS
'Enforces business rule: document_number + document_type must be unique within each year';

-- ==============================================================================
-- STEP 4: Verify fix
-- ==============================================================================

DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT document_number, document_type, EXTRACT(YEAR FROM document_date) as year
        FROM phc.bo
        GROUP BY document_number, document_type, EXTRACT(YEAR FROM document_date)
        HAVING COUNT(*) > 1
    ) duplicates;

    IF remaining_duplicates > 0 THEN
        RAISE EXCEPTION 'Migration failed: Still have % duplicate business keys', remaining_duplicates;
    ELSE
        RAISE NOTICE '✓ All duplicates removed successfully';
    END IF;
END $$;

-- ==============================================================================
-- SUCCESS MESSAGE
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration 20251031_fix_bo_duplicate_records.sql';
    RAISE NOTICE 'Completed successfully';
    RAISE NOTICE '================================================';
END $$;
