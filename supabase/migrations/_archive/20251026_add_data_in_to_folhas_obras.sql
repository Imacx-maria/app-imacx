-- Migration: Add data_in field to folhas_obras table
-- Purpose: Track when a work order (FO) was first created/entered into the system
-- This field will be used across all pages for consistent priority color calculations

-- Add data_in column to folhas_obras table
ALTER TABLE public.folhas_obras 
ADD COLUMN IF NOT EXISTS data_in TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Comment for documentation
COMMENT ON COLUMN public.folhas_obras.data_in IS 'Date when the work order was first entered into the system. Used for priority calculations across all pages.';

-- Backfill existing records: use created_at if available, otherwise use current timestamp
UPDATE public.folhas_obras
SET data_in = COALESCE(created_at, NOW())
WHERE data_in IS NULL;

-- For items_base table - add data_in there too for consistency
ALTER TABLE public.items_base
ADD COLUMN IF NOT EXISTS data_in TIMESTAMP WITH TIME ZONE;

-- Backfill items_base.data_in from their parent folhas_obras
UPDATE public.items_base ib
SET data_in = fo.data_in
FROM public.folhas_obras fo
WHERE ib.folha_obra_id = fo.id
AND ib.data_in IS NULL;

COMMENT ON COLUMN public.items_base.data_in IS 'Date when the work order was first entered (inherited from folhas_obras). Used for priority calculations.';

-- Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_folhas_obras_data_in ON public.folhas_obras(data_in);
CREATE INDEX IF NOT EXISTS idx_items_base_data_in ON public.items_base(data_in);

