-- Debug: Check if customer_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'folhas_obras' 
ORDER BY ordinal_position;

-- Check if any customer_id values exist
SELECT COUNT(*) as total_rows, 
       COUNT(customer_id) as rows_with_customer_id,
       COUNT("Nome") as rows_with_nome
FROM public.folhas_obras;

-- Show sample data
SELECT id, "Numero_do_", "Nome", customer_id 
FROM public.folhas_obras 
LIMIT 10;

-- Check what clientes are available
SELECT customer_id, customer_name 
FROM phc.cl 
LIMIT 5;

-- Try a manual match to see if the UPDATE would work
SELECT fo.id, fo."Numero_do_", fo."Nome", cl.customer_id, cl.customer_name
FROM public.folhas_obras fo
LEFT JOIN phc.cl cl ON LOWER(TRIM(fo."Nome")) = LOWER(TRIM(cl.customer_name))
WHERE fo."Nome" IS NOT NULL
LIMIT 10;
