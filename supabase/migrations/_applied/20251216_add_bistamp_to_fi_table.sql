-- Migration: Add bistamp field to phc.fi table for quote-invoice linking
-- Purpose: Enable linking invoice line items to quote line items via bistamp
-- Date: 2025-11-23

-- Add bistamp column to phc.fi table
ALTER TABLE phc.fi
ADD COLUMN IF NOT EXISTS bistamp text;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_fi_bistamp
ON phc.fi USING btree (bistamp)
TABLESPACE pg_default;

-- Add comment explaining the field
COMMENT ON COLUMN phc.fi.bistamp IS 'Links invoice line item to quote line item (bi.bistamp). Used to trace which quote(s) an invoice was generated from.';
