-- Migration: Repair - Fix deducts_vacation to only apply to Ferias (H, H1, H2)
-- Date: 2025-12-11
-- Description: Only Ferias types should deduct from dias uteis (vacation days)
--              Faltas (F, E) should NOT deduct from vacation balance

-- Update F (Falta) to NOT deduct from vacation
UPDATE public.situation_types
SET deducts_vacation = false, deduction_value = 0
WHERE code = 'F';

-- Update E (Meia falta) to NOT deduct from vacation
UPDATE public.situation_types
SET deducts_vacation = false, deduction_value = 0
WHERE code = 'E';
