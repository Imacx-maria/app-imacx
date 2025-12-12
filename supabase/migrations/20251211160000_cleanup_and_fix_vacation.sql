-- Migration: Cleanup duplicate functions and fix vacation calculations
-- Date: 2025-12-11
--
-- Problem: Multiple versions of calculate_prorated_vacation exist
-- Solution: Drop ALL versions first, then recreate cleanly

-- ============================================
-- Step 1: Aggressively drop all versions of the function
-- ============================================

-- Drop with all possible signatures
DROP FUNCTION IF EXISTS public.calculate_prorated_vacation(DATE, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_prorated_vacation(date, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_prorated_vacation CASCADE;

-- Also drop related functions that might depend on it
DROP FUNCTION IF EXISTS public.recalculate_employee_vacation_balance(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_employee_vacation_total() CASCADE;
DROP TRIGGER IF EXISTS trg_calculate_vacation_total ON public.rh_employees;

-- ============================================
-- Step 2: Recreate calculate_prorated_vacation
-- ============================================
CREATE FUNCTION public.calculate_prorated_vacation(
  p_admission_date DATE,
  p_annual_days INTEGER,
  p_year INTEGER
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $func$
DECLARE
  year_start DATE;
  months_worked INTEGER;
  prorated DECIMAL;
BEGIN
  year_start := make_date(p_year, 1, 1);

  -- Employee started before this year - full entitlement
  IF p_admission_date <= year_start THEN
    RETURN p_annual_days;
  END IF;

  -- Employee starts after this year - no entitlement
  IF p_admission_date > make_date(p_year, 12, 31) THEN
    RETURN 0;
  END IF;

  -- Prorate based on months remaining in year
  -- Employee starting in September (month 9) gets 4 months (Sep, Oct, Nov, Dec)
  months_worked := 12 - EXTRACT(MONTH FROM p_admission_date)::INTEGER + 1;
  prorated := (p_annual_days::DECIMAL * months_worked / 12);

  -- Round to nearest 0.5
  RETURN ROUND(prorated * 2) / 2;
END;
$func$;

-- ============================================
-- Step 3: Recreate recalculate_employee_vacation_balance
-- ============================================
CREATE FUNCTION public.recalculate_employee_vacation_balance(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_total_used DECIMAL;
  v_current_year INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Only count situations where deducts_vacation = TRUE
  -- This should only be H, H1, H2 (Ferias) - NOT F (Falta)
  SELECT COALESCE(SUM(es.business_days * st.deduction_value), 0)
  INTO v_total_used
  FROM public.employee_situations es
  JOIN public.situation_types st ON es.situation_type_id = st.id
  WHERE es.employee_id = p_employee_id
    AND st.deducts_vacation = TRUE
    AND EXTRACT(YEAR FROM es.start_date) = v_current_year;

  UPDATE public.rh_employees
  SET current_year_used = v_total_used, updated_at = NOW()
  WHERE id = p_employee_id;
END;
$func$;

-- ============================================
-- Step 4: Create trigger function for auto-calculation
-- ============================================
CREATE FUNCTION public.calculate_employee_vacation_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
DECLARE
  v_current_year INTEGER;
  v_prorated DECIMAL;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  IF TG_OP = 'INSERT' OR
     OLD.admission_date IS DISTINCT FROM NEW.admission_date OR
     OLD.annual_vacation_days IS DISTINCT FROM NEW.annual_vacation_days THEN

    v_prorated := public.calculate_prorated_vacation(
      NEW.admission_date,
      NEW.annual_vacation_days,
      v_current_year
    );

    NEW.current_year_total := v_prorated;
  END IF;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_calculate_vacation_total
BEFORE INSERT OR UPDATE ON public.rh_employees
FOR EACH ROW
EXECUTE FUNCTION public.calculate_employee_vacation_total();

-- ============================================
-- Step 5: Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.calculate_prorated_vacation(DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_employee_vacation_balance(UUID) TO authenticated;

-- ============================================
-- Step 6: Recalculate ALL employee data
-- ============================================

-- First, update current_year_total for all employees
UPDATE public.rh_employees
SET
  current_year_total = public.calculate_prorated_vacation(
    admission_date,
    annual_vacation_days,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  ),
  updated_at = NOW();

-- Then, recalculate current_year_used for all employees
DO $$
DECLARE
  emp RECORD;
BEGIN
  FOR emp IN SELECT id FROM public.rh_employees
  LOOP
    PERFORM public.recalculate_employee_vacation_balance(emp.id);
  END LOOP;
END $$;
