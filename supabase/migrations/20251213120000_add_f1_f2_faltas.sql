-- Migration: Add F1/F2 (half-day faltas) and migrate E -> F1
-- Date: 2025-12-13
-- Description: 
--   - Add F1 (Meia falta manha) and F2 (Meia falta tarde) situation types
--   - Migrate existing E (Meia falta) records to F1
--   - Deactivate E (keep for historical data but hide from UI)
--   - Ensure F (Falta) is non-deducting (safety check)

-- ============================================
-- Step 1: Insert F1 and F2 situation types
-- ============================================
INSERT INTO public.situation_types (code, name, description, deducts_vacation, deduction_value, is_active) VALUES
  ('F1', 'Meia falta manha', 'Falta 1/2 dia - manha', false, 0.5, true),
  ('F2', 'Meia falta tarde', 'Falta 1/2 dia - tarde', false, 0.5, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  deducts_vacation = EXCLUDED.deducts_vacation,
  deduction_value = EXCLUDED.deduction_value,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Step 2: Migrate existing E records to F1
-- ============================================
UPDATE public.employee_situations
SET situation_type_id = (SELECT id FROM public.situation_types WHERE code = 'F1')
WHERE situation_type_id = (SELECT id FROM public.situation_types WHERE code = 'E');

-- ============================================
-- Step 3: Deactivate E (keep for historical reference)
-- ============================================
UPDATE public.situation_types
SET is_active = false
WHERE code = 'E';

-- ============================================
-- Step 4: Safety check - ensure F (Falta) is non-deducting
-- ============================================
UPDATE public.situation_types
SET deducts_vacation = false, deduction_value = 0
WHERE code = 'F' AND deducts_vacation = true;

