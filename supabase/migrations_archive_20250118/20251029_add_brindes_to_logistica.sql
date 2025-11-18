-- Add brindes field to logistica_entregas table
-- This field indicates if the item is promotional/gift item

ALTER TABLE logistica_entregas
  ADD COLUMN IF NOT EXISTS brindes BOOLEAN DEFAULT false;

COMMENT ON COLUMN logistica_entregas.brindes IS 'Indicates if the item is a promotional/gift item (brindes)';

