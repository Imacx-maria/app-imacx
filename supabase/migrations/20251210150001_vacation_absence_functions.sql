-- Vacation and Absence Management System - Functions
-- Created: 2025-12-10
-- Run this AFTER the tables migration

-- ============================================
-- FUNCTION: generate_employee_sigla
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_employee_sigla(employee_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $func$
DECLARE
  initials TEXT;
  candidate TEXT;
  counter INTEGER := 1;
BEGIN
  SELECT string_agg(upper(left(word, 1)), '')
  INTO initials
  FROM unnest(string_to_array(trim(employee_name), ' ')) AS word
  WHERE length(word) > 0;

  candidate := initials;

  WHILE EXISTS (SELECT 1 FROM public.rh_employees WHERE sigla = candidate) LOOP
    counter := counter + 1;
    candidate := initials || counter::TEXT;
  END LOOP;

  RETURN candidate;
END;
$func$;

-- ============================================
-- FUNCTION: calculate_prorated_vacation
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_prorated_vacation(
  p_admission_date DATE,
  p_annual_days INTEGER,
  p_year INTEGER
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $func$
DECLARE
  year_start DATE;
  months_remaining INTEGER;
  prorated DECIMAL;
BEGIN
  year_start := make_date(p_year, 1, 1);

  IF p_admission_date <= year_start THEN
    RETURN p_annual_days;
  END IF;

  IF p_admission_date > make_date(p_year, 12, 31) THEN
    RETURN 0;
  END IF;

  months_remaining := 12 - EXTRACT(MONTH FROM p_admission_date)::INTEGER + 1;
  prorated := (p_annual_days::DECIMAL * months_remaining / 12);
  RETURN ROUND(prorated * 2) / 2;
END;
$func$;

-- ============================================
-- FUNCTION: update_employee_vacation_balance (TRIGGER)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_employee_vacation_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
DECLARE
  v_employee_id UUID;
  v_total_used DECIMAL;
  v_current_year INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_employee_id := OLD.employee_id;
  ELSE
    v_employee_id := NEW.employee_id;
  END IF;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  SELECT COALESCE(SUM(es.business_days * st.deduction_value), 0)
  INTO v_total_used
  FROM public.employee_situations es
  JOIN public.situation_types st ON es.situation_type_id = st.id
  WHERE es.employee_id = v_employee_id
    AND st.deducts_vacation = TRUE
    AND EXTRACT(YEAR FROM es.start_date) = v_current_year;

  UPDATE public.rh_employees
  SET current_year_used = v_total_used, updated_at = NOW()
  WHERE id = v_employee_id;

  RETURN COALESCE(NEW, OLD);
END;
$func$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_update_vacation_balance ON public.employee_situations;
CREATE TRIGGER trg_update_vacation_balance
AFTER INSERT OR UPDATE OR DELETE ON public.employee_situations
FOR EACH ROW
EXECUTE FUNCTION public.update_employee_vacation_balance();

-- ============================================
-- FUNCTION: vacation_year_transition
-- ============================================
CREATE OR REPLACE FUNCTION public.vacation_year_transition(p_target_year INTEGER)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  previous_remaining DECIMAL,
  carry_over DECIMAL,
  new_entitlement DECIMAL
)
LANGUAGE plpgsql
AS $func$
DECLARE
  v_max_carry_over CONSTANT DECIMAL := 20;
  v_employee RECORD;
  v_remaining DECIMAL;
  v_carry_over DECIMAL;
  v_new_total DECIMAL;
BEGIN
  FOR v_employee IN
    SELECT e.id, e.name, e.admission_date, e.contract_type,
           e.annual_vacation_days, e.previous_year_balance,
           e.current_year_total, e.current_year_used
    FROM public.rh_employees e
    WHERE e.is_active = TRUE
  LOOP
    v_remaining := COALESCE(v_employee.previous_year_balance, 0)
                 + COALESCE(v_employee.current_year_total, 0)
                 - COALESCE(v_employee.current_year_used, 0);

    v_carry_over := LEAST(GREATEST(v_remaining, 0), v_max_carry_over);

    v_new_total := public.calculate_prorated_vacation(
      v_employee.admission_date,
      v_employee.annual_vacation_days,
      p_target_year
    );

    UPDATE public.rh_employees
    SET previous_year_balance = v_carry_over,
        current_year_used = 0,
        current_year_total = v_new_total,
        updated_at = NOW()
    WHERE id = v_employee.id;

    employee_id := v_employee.id;
    employee_name := v_employee.name;
    previous_remaining := v_remaining;
    carry_over := v_carry_over;
    new_entitlement := v_new_total;
    RETURN NEXT;
  END LOOP;
END;
$func$;

-- ============================================
-- FUNCTION: get_employee_calendar_data
-- ============================================
CREATE OR REPLACE FUNCTION public.get_employee_calendar_data(
  p_year INTEGER,
  p_month INTEGER DEFAULT NULL,
  p_department_id BIGINT DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  employee_sigla TEXT,
  departamento_id BIGINT,
  situation_date DATE,
  situation_type_code TEXT,
  situation_type_name TEXT,
  is_half_day BOOLEAN
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.sigla AS employee_sigla,
    e.departamento_id,
    d.date_value AS situation_date,
    st.code AS situation_type_code,
    st.name AS situation_type_name,
    (st.deduction_value = 0.5) AS is_half_day
  FROM public.rh_employees e
  JOIN public.employee_situations es ON es.employee_id = e.id
  JOIN public.situation_types st ON es.situation_type_id = st.id
  CROSS JOIN LATERAL (
    SELECT generate_series(es.start_date, es.end_date, '1 day'::interval)::date AS date_value
  ) d
  WHERE e.is_active = TRUE
    AND EXTRACT(YEAR FROM d.date_value) = p_year
    AND (p_month IS NULL OR EXTRACT(MONTH FROM d.date_value) = p_month)
    AND (p_department_id IS NULL OR e.departamento_id = p_department_id)
    AND (p_employee_id IS NULL OR e.id = p_employee_id)
  ORDER BY e.name, d.date_value;
END;
$func$;

-- ============================================
-- FUNCTION: get_vacation_summary
-- ============================================
CREATE OR REPLACE FUNCTION public.get_vacation_summary(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_department_id BIGINT DEFAULT NULL
)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  employee_sigla TEXT,
  departamento_nome TEXT,
  contract_type TEXT,
  admission_date DATE,
  annual_days INTEGER,
  previous_balance DECIMAL,
  current_total DECIMAL,
  current_used DECIMAL,
  remaining DECIMAL
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.sigla AS employee_sigla,
    dept.nome AS departamento_nome,
    e.contract_type,
    e.admission_date,
    e.annual_vacation_days AS annual_days,
    COALESCE(e.previous_year_balance, 0) AS previous_balance,
    COALESCE(e.current_year_total, 0) AS current_total,
    COALESCE(e.current_year_used, 0) AS current_used,
    (COALESCE(e.previous_year_balance, 0) + COALESCE(e.current_year_total, 0) - COALESCE(e.current_year_used, 0)) AS remaining
  FROM public.rh_employees e
  LEFT JOIN public.departamentos dept ON e.departamento_id = dept.id
  WHERE e.is_active = TRUE
    AND (p_department_id IS NULL OR e.departamento_id = p_department_id)
  ORDER BY dept.nome NULLS LAST, e.name;
END;
$func$;

-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.generate_employee_sigla(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorated_vacation(DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vacation_year_transition(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_calendar_data(INTEGER, INTEGER, BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vacation_summary(INTEGER, BIGINT) TO authenticated;
