# Quick Check: Has the Migration Worked?

Run these queries in Supabase SQL Editor to verify:

## 1. Check if customer_id column exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'folhas_obras'
ORDER BY ordinal_position;
```

**Expected result:** Should show a `customer_id` column of type `integer`

---

## 2. Check data in folhas_obras
```sql
SELECT id, "Numero_do_", "Nome", customer_id 
FROM public.folhas_obras 
LIMIT 5;
```

**Expected result:** Should show the customer_id column populated for rows with "Nome" filled in

---

## 3. Check phc.cl data
```sql
SELECT customer_id, customer_name 
FROM phc.cl 
LIMIT 5;
```

**Expected result:** Customer IDs and their names

---

## 4. Check for mismatches
```sql
SELECT fo."Numero_do_", fo."Nome", cl.customer_id, cl.customer_name
FROM public.folhas_obras fo
LEFT JOIN phc.cl cl ON fo.customer_id = cl.customer_id
LIMIT 10;
```

**If customer_id is NULL but Nome has a value:** The backfill didn't work

---

## 5. If customer_id is NULL, try manual backfill
```sql
UPDATE public.folhas_obras fo
SET customer_id = cl.customer_id
FROM phc.cl cl
WHERE fo."Nome" IS NOT NULL 
  AND fo.customer_id IS NULL
  AND LOWER(TRIM(fo."Nome")) = LOWER(TRIM(cl.customer_name));

-- Check how many rows were updated
SELECT COUNT(*) as updated_rows FROM public.folhas_obras WHERE customer_id IS NOT NULL;
```

---

## What to report back with:
1. Does the `customer_id` column exist?
2. Are there any rows with customer_id filled in?
3. How many rows have "Nome" but no customer_id?
4. After running the manual backfill, how many rows have customer_id?
