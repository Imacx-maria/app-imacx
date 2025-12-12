-- Vacation policy updates to align with Portuguese law and internal freelancer rule

-- Single-row settings table for vacation defaults
CREATE TABLE IF NOT EXISTS public.vacation_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  contract_default_days INTEGER NOT NULL DEFAULT 22,
  freelancer_default_days INTEGER NOT NULL DEFAULT 11,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_vacation_settings_row CHECK (id = TRUE)
);

INSERT INTO public.vacation_settings (id, contract_default_days, freelancer_default_days)
VALUES (TRUE, 22, 11)
ON CONFLICT (id) DO NOTHING;

-- Normalize existing freelancer defaults to the configured value when still using the previous static number
UPDATE public.rh_employees e
SET annual_vacation_days = vs.freelancer_default_days
FROM public.vacation_settings vs
WHERE e.contract_type = 'freelancer'
  AND (e.annual_vacation_days IS NULL OR e.annual_vacation_days = 12);

ALTER TABLE public.vacation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vacation_settings_read" ON public.vacation_settings;
DROP POLICY IF EXISTS "vacation_settings_write" ON public.vacation_settings;

CREATE POLICY "vacation_settings_read" ON public.vacation_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vacation_settings_write" ON public.vacation_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Expose defaults so the app can stay configurable
CREATE OR REPLACE FUNCTION public.get_vacation_policy_defaults()
RETURNS TABLE(
  contract_default_days INTEGER,
  freelancer_default_days INTEGER
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(vs.contract_default_days, 22),
    COALESCE(vs.freelancer_default_days, 11)
  FROM public.vacation_settings vs
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 22, 11;
  END IF;
END;
$func$;

-- Updated calculation per Portuguese law (first year accrual + cap) and internal freelancer rule
CREATE OR REPLACE FUNCTION public.calculate_prorated_vacation(
  p_admission_date DATE,
  p_annual_days INTEGER,
  p_year INTEGER,
  p_contract_type TEXT DEFAULT 'contract'
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $func$
DECLARE
  year_end DATE := make_date(p_year, 12, 31);
  first_full_month DATE;
  months_worked INTEGER := 0;
  normalized_contract TEXT := lower(COALESCE(p_contract_type, 'contract'));
  base_contract_days INTEGER := 22;
  base_freelancer_days INTEGER := 11;
  settings RECORD;
BEGIN
  SELECT contract_default_days, freelancer_default_days
  INTO settings
  FROM public.vacation_settings
  LIMIT 1;

  IF FOUND THEN
    base_contract_days := COALESCE(settings.contract_default_days, base_contract_days);
    base_freelancer_days := COALESCE(settings.freelancer_default_days, base_freelancer_days);
  END IF;

  -- No entitlement before admission year
  IF p_year < EXTRACT(YEAR FROM p_admission_date)::INTEGER THEN
    RETURN 0;
  END IF;

  -- Freelancers use internal default (configurable)
  IF normalized_contract = 'freelancer' THEN
    RETURN COALESCE(p_annual_days, base_freelancer_days);
  END IF;

  -- Admission year: 2 days per full worked month, capped at 20
  IF p_year = EXTRACT(YEAR FROM p_admission_date)::INTEGER THEN
    first_full_month := CASE
      WHEN EXTRACT(DAY FROM p_admission_date) = 1 THEN p_admission_date
      ELSE (date_trunc('month', p_admission_date) + INTERVAL '1 month')::DATE
    END;

    IF first_full_month > year_end THEN
      RETURN 0;
    END IF;

    months_worked :=
      (12 * (EXTRACT(YEAR FROM year_end)::INTEGER - EXTRACT(YEAR FROM first_full_month)::INTEGER))
      + (EXTRACT(MONTH FROM year_end)::INTEGER - EXTRACT(MONTH FROM first_full_month)::INTEGER)
      + 1;

    RETURN LEAST(months_worked * 2, 20);
  END IF;

  -- Subsequent years: fixed annual entitlement (default 22)
  RETURN COALESCE(p_annual_days, base_contract_days);
END;
$func$;

-- Transition function now uses configurable defaults and updated calculation
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
  v_base_contract_days INTEGER := 22;
  v_base_freelancer_days INTEGER := 11;
  v_settings RECORD;
  v_annual_days INTEGER;
BEGIN
  SELECT contract_default_days, freelancer_default_days
  INTO v_settings
  FROM public.vacation_settings
  LIMIT 1;

  IF FOUND THEN
    v_base_contract_days := COALESCE(v_settings.contract_default_days, v_base_contract_days);
    v_base_freelancer_days := COALESCE(v_settings.freelancer_default_days, v_base_freelancer_days);
  END IF;

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

    v_annual_days := COALESCE(
      v_employee.annual_vacation_days,
      CASE
        WHEN v_employee.contract_type = 'freelancer' THEN v_base_freelancer_days
        ELSE v_base_contract_days
      END
    );

    v_new_total := public.calculate_prorated_vacation(
      v_employee.admission_date,
      v_annual_days,
      p_target_year,
      v_employee.contract_type
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

GRANT EXECUTE ON FUNCTION public.get_vacation_policy_defaults() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorated_vacation(DATE, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vacation_year_transition(INTEGER) TO authenticated;
