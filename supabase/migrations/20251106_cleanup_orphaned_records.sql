-- Migration to clean up orphaned records
-- This removes any records that reference non-existent parent records

-- Log the counts before cleanup for reference
DO $$
DECLARE
  orphaned_items_count INTEGER;
  orphaned_designer_items_count INTEGER;
  orphaned_logistica_count INTEGER;
  orphaned_operacoes_count INTEGER;
  orphaned_planos_count INTEGER;
BEGIN
  -- Count orphaned items_base records (no parent in folhas_obras)
  SELECT COUNT(*) INTO orphaned_items_count
  FROM public.items_base ib
  WHERE NOT EXISTS (
    SELECT 1 FROM public.folhas_obras fo WHERE fo.id = ib.folha_obra_id
  );
  
  -- Count orphaned designer_items records (no parent in items_base)
  SELECT COUNT(*) INTO orphaned_designer_items_count
  FROM public.designer_items di
  WHERE NOT EXISTS (
    SELECT 1 FROM public.items_base ib WHERE ib.id = di.item_id
  );
  
  -- Count orphaned logistica_entregas records (no parent in items_base)
  SELECT COUNT(*) INTO orphaned_logistica_count
  FROM public.logistica_entregas le
  WHERE NOT EXISTS (
    SELECT 1 FROM public.items_base ib WHERE ib.id = le.item_id
  );
  
  -- Count orphaned producao_operacoes records (if column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_operacoes'
      AND column_name = 'item_id'
  ) THEN
    SELECT COUNT(*) INTO orphaned_operacoes_count
    FROM public.producao_operacoes po
    WHERE NOT EXISTS (
      SELECT 1 FROM public.items_base ib WHERE ib.id = po.item_id
    );
  ELSE
    orphaned_operacoes_count := 0;
  END IF;
  
  -- Count orphaned designer_planos records (if table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'designer_planos'
  ) THEN
    SELECT COUNT(*) INTO orphaned_planos_count
    FROM public.designer_planos dp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.items_base ib WHERE ib.id = dp.item_id
    );
  ELSE
    orphaned_planos_count := 0;
  END IF;
  
  RAISE NOTICE '=== ORPHANED RECORDS FOUND ===';
  RAISE NOTICE 'items_base (no folha_obra): %', orphaned_items_count;
  RAISE NOTICE 'designer_items (no item): %', orphaned_designer_items_count;
  RAISE NOTICE 'logistica_entregas (no item): %', orphaned_logistica_count;
  RAISE NOTICE 'producao_operacoes (no item): %', orphaned_operacoes_count;
  RAISE NOTICE 'designer_planos (no item): %', orphaned_planos_count;
  RAISE NOTICE '==============================';
END $$;

-- Step 1: Delete orphaned designer_planos (if table exists)
-- These reference non-existent items_base records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'designer_planos'
  ) THEN
    DELETE FROM public.designer_planos
    WHERE NOT EXISTS (
      SELECT 1 FROM public.items_base ib WHERE ib.id = designer_planos.item_id
    );
    RAISE NOTICE 'Deleted orphaned designer_planos records';
  END IF;
END $$;

-- Step 2: Delete orphaned producao_operacoes (if item_id column exists)
-- These reference non-existent items_base records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_operacoes'
      AND column_name = 'item_id'
  ) THEN
    DELETE FROM public.producao_operacoes
    WHERE NOT EXISTS (
      SELECT 1 FROM public.items_base ib WHERE ib.id = producao_operacoes.item_id
    );
    RAISE NOTICE 'Deleted orphaned producao_operacoes records';
  END IF;
END $$;

-- Step 3: Delete orphaned logistica_entregas
-- These reference non-existent items_base records
DELETE FROM public.logistica_entregas
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = logistica_entregas.item_id
);

-- Step 4: Delete orphaned designer_items
-- These reference non-existent items_base records
DELETE FROM public.designer_items
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = designer_items.item_id
);

-- Step 5: Delete orphaned items_base
-- These reference non-existent folhas_obras records
-- This is the root cleanup - delete items that have no parent job
DELETE FROM public.items_base
WHERE NOT EXISTS (
  SELECT 1 FROM public.folhas_obras fo WHERE fo.id = items_base.folha_obra_id
);

-- Log the final counts after cleanup
DO $$
DECLARE
  remaining_items_count INTEGER;
  remaining_designer_items_count INTEGER;
  remaining_logistica_count INTEGER;
  remaining_operacoes_count INTEGER;
  remaining_planos_count INTEGER;
BEGIN
  -- Count remaining items_base records
  SELECT COUNT(*) INTO remaining_items_count FROM public.items_base;
  
  -- Count remaining designer_items records
  SELECT COUNT(*) INTO remaining_designer_items_count FROM public.designer_items;
  
  -- Count remaining logistica_entregas records
  SELECT COUNT(*) INTO remaining_logistica_count FROM public.logistica_entregas;
  
  -- Count remaining producao_operacoes records
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_operacoes'
      AND column_name = 'item_id'
  ) THEN
    SELECT COUNT(*) INTO remaining_operacoes_count FROM public.producao_operacoes;
  ELSE
    remaining_operacoes_count := 0;
  END IF;
  
  -- Count remaining designer_planos records
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'designer_planos'
  ) THEN
    SELECT COUNT(*) INTO remaining_planos_count FROM public.designer_planos;
  ELSE
    remaining_planos_count := 0;
  END IF;
  
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
  RAISE NOTICE 'Remaining items_base: %', remaining_items_count;
  RAISE NOTICE 'Remaining designer_items: %', remaining_designer_items_count;
  RAISE NOTICE 'Remaining logistica_entregas: %', remaining_logistica_count;
  RAISE NOTICE 'Remaining producao_operacoes: %', remaining_operacoes_count;
  RAISE NOTICE 'Remaining designer_planos: %', remaining_planos_count;
  RAISE NOTICE '========================';
END $$;

-- Add a comment to document when this cleanup was performed
COMMENT ON TABLE public.items_base IS 
  'Cleanup of orphaned records performed on ' || CURRENT_TIMESTAMP::TEXT || 
  '. All items now have valid folha_obra_id references.';
