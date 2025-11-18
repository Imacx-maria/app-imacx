-- Migration to clean up orphaned records - Simplified version
-- Run each section separately if needed

-- ============================================
-- SECTION 1: Count orphaned records (OPTIONAL - for logging)
-- ============================================

-- Count orphaned items_base
SELECT 
  'items_base orphaned' as info,
  COUNT(*) as count
FROM public.items_base ib
WHERE NOT EXISTS (
  SELECT 1 FROM public.folhas_obras fo WHERE fo.id = ib.folha_obra_id
);

-- Count orphaned designer_items
SELECT 
  'designer_items orphaned' as info,
  COUNT(*) as count
FROM public.designer_items di
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = di.item_id
);

-- Count orphaned logistica_entregas
SELECT 
  'logistica_entregas orphaned' as info,
  COUNT(*) as count
FROM public.logistica_entregas le
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = le.item_id
);

-- ============================================
-- SECTION 2: Delete orphaned records
-- ============================================

-- Delete orphaned designer_planos (if table exists)
DELETE FROM public.designer_planos
WHERE EXISTS (SELECT 1 FROM public.designer_planos LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM public.items_base ib WHERE ib.id = designer_planos.item_id
  );

-- Delete orphaned logistica_entregas
DELETE FROM public.logistica_entregas
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = logistica_entregas.item_id
);

-- Delete orphaned designer_items
DELETE FROM public.designer_items
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = designer_items.item_id
);

-- Delete orphaned items_base (ROOT CLEANUP)
DELETE FROM public.items_base
WHERE NOT EXISTS (
  SELECT 1 FROM public.folhas_obras fo WHERE fo.id = items_base.folha_obra_id
);

-- ============================================
-- SECTION 3: Verify cleanup (OPTIONAL - check results)
-- ============================================

-- Verify no orphaned records remain
SELECT 
  'Verification: items_base orphaned' as info,
  COUNT(*) as should_be_zero
FROM public.items_base ib
WHERE NOT EXISTS (
  SELECT 1 FROM public.folhas_obras fo WHERE fo.id = ib.folha_obra_id
);

SELECT 
  'Verification: designer_items orphaned' as info,
  COUNT(*) as should_be_zero
FROM public.designer_items di
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = di.item_id
);

SELECT 
  'Verification: logistica_entregas orphaned' as info,
  COUNT(*) as should_be_zero
FROM public.logistica_entregas le
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_base ib WHERE ib.id = le.item_id
);
