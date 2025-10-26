-- Add Foreign Key Constraints for FI Tables
-- ============================================
-- Ensures referential integrity between FI (invoice line items) and FT (invoices)

-- 1. Add foreign key for regular fi table
ALTER TABLE phc.fi 
ADD CONSTRAINT fk_fi_invoice 
FOREIGN KEY (invoice_id) 
REFERENCES phc.ft(invoice_id) 
ON DELETE CASCADE;

-- 2. Add foreign key for 2years_fi table
ALTER TABLE phc."2years_fi" 
ADD CONSTRAINT fk_2years_fi_invoice 
FOREIGN KEY (invoice_id) 
REFERENCES phc."2years_ft"(invoice_id) 
ON DELETE CASCADE;

-- 3. Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_fi_invoice_id ON phc.fi(invoice_id);
CREATE INDEX IF NOT EXISTS idx_2years_fi_invoice_id ON phc."2years_fi"(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fi_cost_center ON phc.fi(cost_center);
CREATE INDEX IF NOT EXISTS idx_2years_fi_cost_center ON phc."2years_fi"(cost_center);

-- Summary:
-- ✅ FI lines are now enforced to have valid FT invoices
-- ✅ If an FT invoice is deleted, its FI lines are also deleted (CASCADE)
-- ✅ Indexes improve JOIN performance

