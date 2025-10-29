-- Migration to support standalone deliveries without FO/ORC
-- This allows creating logistics entries that are not linked to items_base

-- Make item_id nullable to allow standalone deliveries
ALTER TABLE logistica_entregas
  ALTER COLUMN item_id DROP NOT NULL;

-- Add direct fields for standalone deliveries
-- These will be used when item_id is null

-- Cliente name (direct text, not relational)
ALTER TABLE logistica_entregas
  ADD COLUMN IF NOT EXISTS cliente TEXT;

-- Campaign name (direct text, not relational)
ALTER TABLE logistica_entregas
  ADD COLUMN IF NOT EXISTS nome_campanha TEXT;

-- FO number (direct text, not relational)
ALTER TABLE logistica_entregas
  ADD COLUMN IF NOT EXISTS numero_fo TEXT;

-- ORC number (direct integer, not relational)
ALTER TABLE logistica_entregas
  ADD COLUMN IF NOT EXISTS numero_orc INTEGER;

-- Add comment to explain the dual-mode structure
COMMENT ON TABLE logistica_entregas IS 'Logistics deliveries table. Can be linked to items_base (item_id) or standalone with direct fields (cliente, nome_campanha, numero_fo, numero_orc, descricao)';

