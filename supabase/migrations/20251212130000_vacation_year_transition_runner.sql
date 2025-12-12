-- Vacation Year Transition Runner
-- Provides idempotent, safe year-end carryover with logging and concurrency protection

-- 1. Create log table to track transition runs (prevents duplicate runs)
CREATE TABLE IF NOT EXISTS public.vacation_year_transition_runs (
  id SERIAL PRIMARY KEY,
  target_year INTEGER NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by TEXT,
  employees_updated INTEGER NOT NULL DEFAULT 0,
  details JSONB
);

-- Add comment for documentation
COMMENT ON TABLE public.vacation_year_transition_runs IS
  'Tracks vacation year transition executions to prevent duplicate runs for the same year';

-- RLS for the log table
ALTER TABLE public.vacation_year_transition_runs ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (cron jobs, API routes)
CREATE POLICY "vacation_transition_runs_service_only"
  ON public.vacation_year_transition_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read (for admin dashboards)
CREATE POLICY "vacation_transition_runs_read_authenticated"
  ON public.vacation_year_transition_runs
  FOR SELECT
  TO authenticated
  USING (true);


-- 2. Drop existing function (return type changed - added pre_registered_used column)
DROP FUNCTION IF EXISTS public.vacation_year_transition(INTEGER);

-- 3. Recreate vacation_year_transition with updated return type
--    Now also recalculates current_year_used for pre-registered situations in target year
CREATE OR REPLACE FUNCTION public.vacation_year_transition(p_target_year INTEGER)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  previous_remaining DECIMAL,
  carry_over DECIMAL,
  new_entitlement DECIMAL,
  pre_registered_used DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_max_carry_over CONSTANT DECIMAL := 20;
  v_employee RECORD;
  v_remaining DECIMAL;
  v_carry_over DECIMAL;
  v_new_total DECIMAL;
  v_pre_used DECIMAL;
  v_base_contract_days INTEGER := 22;
  v_base_freelancer_days INTEGER := 11;
  v_settings RECORD;
  v_annual_days INTEGER;
  v_target_year_start DATE;
  v_target_year_end DATE;
BEGIN
  -- Calculate target year date range
  v_target_year_start := make_date(p_target_year, 1, 1);
  v_target_year_end := make_date(p_target_year, 12, 31);

  -- Get configurable defaults
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
    -- Calculate remaining from previous year
    v_remaining := COALESCE(v_employee.previous_year_balance, 0)
                 + COALESCE(v_employee.current_year_total, 0)
                 - COALESCE(v_employee.current_year_used, 0);

    -- Apply carryover cap
    v_carry_over := LEAST(GREATEST(v_remaining, 0), v_max_carry_over);

    -- Determine annual days
    v_annual_days := COALESCE(
      v_employee.annual_vacation_days,
      CASE
        WHEN v_employee.contract_type = 'freelancer' THEN v_base_freelancer_days
        ELSE v_base_contract_days
      END
    );

    -- Calculate new entitlement for target year
    v_new_total := public.calculate_prorated_vacation(
      v_employee.admission_date,
      v_annual_days,
      p_target_year,
      v_employee.contract_type
    );

    -- Calculate already-used days for target year from pre-registered situations
    SELECT COALESCE(SUM(
      CASE
        WHEN es.situation_type IN ('ferias', 'ferias_meio_dia')
             AND es.deducts_vacation = true
        THEN
          CASE
            WHEN es.situation_type = 'ferias_meio_dia' THEN 0.5
            ELSE 1.0
          END
        ELSE 0
      END
    ), 0)
    INTO v_pre_used
    FROM public.employee_situations es
    WHERE es.employee_id = v_employee.id
      AND es.date >= v_target_year_start
      AND es.date <= v_target_year_end
      AND es.situation_type IN ('ferias', 'ferias_meio_dia')
      AND es.deducts_vacation = true;

    -- Update employee record
    UPDATE public.rh_employees
    SET previous_year_balance = v_carry_over,
        current_year_used = v_pre_used,
        current_year_total = v_new_total,
        updated_at = NOW()
    WHERE id = v_employee.id;

    -- Return row for logging
    employee_id := v_employee.id;
    employee_name := v_employee.name;
    previous_remaining := v_remaining;
    carry_over := v_carry_over;
    new_entitlement := v_new_total;
    pre_registered_used := v_pre_used;
    RETURN NEXT;
  END LOOP;
END;
$func$;


-- 4. Create the idempotent wrapper function with advisory lock
CREATE OR REPLACE FUNCTION public.run_vacation_year_transition_if_needed(
  p_target_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  target_year INTEGER,
  already_run BOOLEAN,
  employees_updated INTEGER,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_target_year INTEGER;
  v_lock_id BIGINT;
  v_already_run BOOLEAN;
  v_count INTEGER := 0;
  v_results JSONB;
  v_employee_results JSONB := '[]'::JSONB;
  v_row RECORD;
BEGIN
  -- Default to current year if not specified
  v_target_year := COALESCE(p_target_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  -- Use advisory lock to prevent concurrent runs (lock_id based on year)
  v_lock_id := 8675309 + v_target_year; -- Unique lock ID per year

  -- Try to acquire advisory lock (non-blocking)
  IF NOT pg_try_advisory_lock(v_lock_id) THEN
    status := 'locked';
    target_year := v_target_year;
    already_run := NULL;
    employees_updated := 0;
    details := jsonb_build_object(
      'message', 'Another transition is currently running for this year',
      'lock_id', v_lock_id
    );
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    -- Check if already run for this year
    SELECT EXISTS(
      SELECT 1 FROM public.vacation_year_transition_runs
      WHERE vacation_year_transition_runs.target_year = v_target_year
    ) INTO v_already_run;

    IF v_already_run THEN
      -- Already run, return without changes
      status := 'skipped';
      target_year := v_target_year;
      already_run := true;
      employees_updated := 0;

      SELECT jsonb_build_object(
        'message', 'Year transition already executed',
        'previous_run', jsonb_build_object(
          'executed_at', r.executed_at,
          'employees_updated', r.employees_updated
        )
      )
      INTO details
      FROM public.vacation_year_transition_runs r
      WHERE r.target_year = v_target_year;

      RETURN NEXT;
    ELSE
      -- Execute the transition
      FOR v_row IN
        SELECT * FROM public.vacation_year_transition(v_target_year)
      LOOP
        v_count := v_count + 1;
        v_employee_results := v_employee_results || jsonb_build_object(
          'employee_id', v_row.employee_id,
          'employee_name', v_row.employee_name,
          'previous_remaining', v_row.previous_remaining,
          'carry_over', v_row.carry_over,
          'new_entitlement', v_row.new_entitlement,
          'pre_registered_used', v_row.pre_registered_used
        );
      END LOOP;

      -- Log the successful run
      INSERT INTO public.vacation_year_transition_runs (
        target_year,
        executed_at,
        executed_by,
        employees_updated,
        details
      ) VALUES (
        v_target_year,
        NOW(),
        current_user,
        v_count,
        jsonb_build_object('employees', v_employee_results)
      );

      -- Return success
      status := 'success';
      target_year := v_target_year;
      already_run := false;
      employees_updated := v_count;
      details := jsonb_build_object(
        'message', 'Year transition completed successfully',
        'employees_processed', v_count,
        'summary', v_employee_results
      );
      RETURN NEXT;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- On error, release lock and re-raise
    PERFORM pg_advisory_unlock(v_lock_id);
    RAISE;
  END;

  -- Release advisory lock
  PERFORM pg_advisory_unlock(v_lock_id);
END;
$func$;


-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.vacation_year_transition(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vacation_year_transition(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_vacation_year_transition_if_needed(INTEGER) TO service_role;

-- Also grant SELECT on log table to authenticated for dashboard visibility
GRANT SELECT ON public.vacation_year_transition_runs TO authenticated;
GRANT ALL ON public.vacation_year_transition_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.vacation_year_transition_runs_id_seq TO service_role;


-- 6. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vacation_transition_runs_year
  ON public.vacation_year_transition_runs(target_year);
