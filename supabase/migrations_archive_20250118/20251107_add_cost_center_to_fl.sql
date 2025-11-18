-- Add cost_center column to FL (Suppliers) table
-- Migration: 20251107_add_cost_center_to_fl.sql

-- Add the cost_center column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'phc'
        AND table_name = 'fl'
        AND column_name = 'cost_center'
    ) THEN
        ALTER TABLE phc.fl ADD COLUMN cost_center TEXT;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN phc.fl.cost_center IS 'Cost center (PHC: ccusto)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fl_cost_center ON phc.fl(cost_center);
