-- Migration: Drop the unique business key index from phc.bo
-- Date: 2025-10-31
-- Reason: The unique constraint on (document_number, document_type, year) is too strict.
--         The PHC source database allows different documents (different bostamp/document_id)
--         with the same business key, so we cannot enforce this constraint.
--         We rely solely on document_id (bostamp) as the primary key.

-- Drop the unique index
DROP INDEX IF EXISTS phc.idx_bo_unique_business_key;

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Dropped idx_bo_unique_business_key';
    RAISE NOTICE 'BO table now relies only on document_id PK';
    RAISE NOTICE '================================================';
END $$;
