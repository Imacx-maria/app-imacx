# Migration: Add customer_id to folhas_obras

This migration adds a `customer_id` column to the `folhas_obras` table to properly link jobs with clients from the `phc.cl` table.

## Why This is Needed

The cliente combobox was showing empty for existing data because:
1. Only the cliente **name** was stored in `folhas_obras.Nome`
2. The combobox needs the cliente **ID** to match with the options from `phc.cl`
3. Without the customer_id, the UI state (id_cliente) was lost on page refresh

## What the Migration Does

1. Adds a `customer_id` column (INTEGER) to `folhas_obras`
2. Creates a foreign key constraint to `phc.cl(customer_id)`
3. Creates an index for better query performance
4. Backfills existing data by matching customer names

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Copy the SQL from the migration file below
3. Click "Run" to execute

### Option 2: Via Supabase CLI

```bash
cd "C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean"
supabase db push
```

## Migration SQL

```sql
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
```

## Verification

After running the migration, verify it worked:

1. Check the column was added:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'folhas_obras' AND column_name = 'customer_id';
   ```

2. Check the constraint was created:
   ```sql
   SELECT constraint_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'folhas_obras' AND constraint_type = 'FOREIGN KEY';
   ```

3. Check existing data was backfilled:
   ```sql
   SELECT COUNT(*) as records_with_customer_id
   FROM public.folhas_obras 
   WHERE customer_id IS NOT NULL;
   ```

## What to Expect After Migration

- ✅ Cliente names will display correctly for both old and new FOs
- ✅ Cliente names persist after page refresh
- ✅ No more fuzzy matching needed
- ✅ Proper referential integrity with the phc.cl table
- ✅ Better query performance with the index

## Troubleshooting

**If the migration fails:**

1. Check if you have permission to modify the schema
2. Ensure the `phc.cl` table has the expected structure
3. Try running each statement separately to identify which one fails

**If clientes still don't show after migration:**

1. Make sure you refreshed the page (hard refresh: Ctrl+Shift+R)
2. Check browser console for any error messages
3. Verify the migration ran successfully in Supabase dashboard

## Rollback (if needed)

If you need to revert this migration:

```sql
-- Drop the foreign key constraint
ALTER TABLE public.folhas_obras 
DROP CONSTRAINT fk_folhas_obras_customer_id;

-- Drop the index
DROP INDEX idx_folhas_obras_customer_id;

-- Drop the column
ALTER TABLE public.folhas_obras 
DROP COLUMN customer_id;
```
