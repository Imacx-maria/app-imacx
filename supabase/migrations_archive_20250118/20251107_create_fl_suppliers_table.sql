-- Create FL (Suppliers) table in PHC schema
-- This table stores active suppliers from PHC
-- Migration: 20251107_create_fl_suppliers_table.sql

-- Create table
CREATE TABLE IF NOT EXISTS phc.fl (
    supplier_id INTEGER NOT NULL PRIMARY KEY,
    supplier_name TEXT,
    cost_center TEXT,
    is_inactive BOOLEAN DEFAULT false
);

-- Add comments for documentation
COMMENT ON TABLE phc.fl IS 'Active suppliers imported from PHC FL table';
COMMENT ON COLUMN phc.fl.supplier_id IS 'Supplier number (PHC: no)';
COMMENT ON COLUMN phc.fl.supplier_name IS 'Supplier name (PHC: nome)';
COMMENT ON COLUMN phc.fl.cost_center IS 'Cost center (PHC: ccusto)';
COMMENT ON COLUMN phc.fl.is_inactive IS 'Inactive flag - only active suppliers imported (PHC: inactivo = 0)';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_fl_supplier_name ON phc.fl(supplier_name);
CREATE INDEX IF NOT EXISTS idx_fl_cost_center ON phc.fl(cost_center);
CREATE INDEX IF NOT EXISTS idx_fl_is_inactive ON phc.fl(is_inactive);

-- Grant permissions (adjust as needed for your security requirements)
-- Grant SELECT to authenticated users
GRANT SELECT ON phc.fl TO authenticated;

-- Optional: Create RLS policies if needed
-- Uncomment if you want Row-Level Security
-- ALTER TABLE phc.fl ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read access to authenticated users" ON phc.fl
--     FOR SELECT
--     TO authenticated
--     USING (true);
