-- Add customer_id column to folhas_obras table
-- This stores the reference to phc.cl(customer_id) to enable proper cliente combobox display

-- Add the customer_id column
ALTER TABLE public.folhas_obras 
ADD COLUMN customer_id INTEGER;

-- Add foreign key reference to phc.cl
ALTER TABLE public.folhas_obras
ADD CONSTRAINT fk_folhas_obras_customer_id 
FOREIGN KEY (customer_id) 
REFERENCES phc.cl(customer_id);

-- Create index for better performance on lookups
CREATE INDEX idx_folhas_obras_customer_id 
ON public.folhas_obras(customer_id);

-- Backfill customer_id for existing records based on Nome matching
UPDATE public.folhas_obras fo
SET customer_id = cl.customer_id
FROM phc.cl cl
WHERE fo."Nome" IS NOT NULL 
  AND fo.customer_id IS NULL
  AND LOWER(TRIM(fo."Nome")) = LOWER(TRIM(cl.customer_name));

-- Log migration result
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM public.folhas_obras WHERE customer_id IS NOT NULL;
  RAISE NOTICE 'Migration complete: % records have customer_id set', updated_count;
END $$;
