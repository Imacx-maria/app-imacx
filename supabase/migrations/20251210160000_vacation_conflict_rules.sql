-- Vacation Conflict Rules System
-- Created: 2025-12-10
-- Purpose: Define groups of employees that cannot all be absent simultaneously

-- ============================================
-- TABLE 1: vacation_conflict_rules
-- Main rules table defining employee groups
-- ============================================
CREATE TABLE IF NOT EXISTS public.vacation_conflict_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  max_absent INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active rules
CREATE INDEX IF NOT EXISTS idx_conflict_rules_active ON public.vacation_conflict_rules(is_active);

-- ============================================
-- TABLE 2: vacation_conflict_rule_members
-- Links employees to conflict rules
-- ============================================
CREATE TABLE IF NOT EXISTS public.vacation_conflict_rule_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.vacation_conflict_rules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.rh_employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, employee_id)
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_rule_members_rule ON public.vacation_conflict_rule_members(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_members_employee ON public.vacation_conflict_rule_members(employee_id);

-- ============================================
-- TABLE 3: vacation_conflict_sub_rules
-- Special constraints within a rule group
-- e.g., Nei+Varela cannot both be absent even if group allows 2
-- ============================================
CREATE TABLE IF NOT EXISTS public.vacation_conflict_sub_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.vacation_conflict_rules(id) ON DELETE CASCADE,
  employee_ids UUID[] NOT NULL,
  max_absent INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sub-rules by rule
CREATE INDEX IF NOT EXISTS idx_sub_rules_rule ON public.vacation_conflict_sub_rules(rule_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.vacation_conflict_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_conflict_rule_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_conflict_sub_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "conflict_rules_read" ON public.vacation_conflict_rules;
DROP POLICY IF EXISTS "conflict_rules_write" ON public.vacation_conflict_rules;
DROP POLICY IF EXISTS "rule_members_read" ON public.vacation_conflict_rule_members;
DROP POLICY IF EXISTS "rule_members_write" ON public.vacation_conflict_rule_members;
DROP POLICY IF EXISTS "sub_rules_read" ON public.vacation_conflict_sub_rules;
DROP POLICY IF EXISTS "sub_rules_write" ON public.vacation_conflict_sub_rules;

-- Conflict Rules: All authenticated can read
CREATE POLICY "conflict_rules_read" ON public.vacation_conflict_rules
  FOR SELECT TO authenticated USING (true);

-- Conflict Rules: Authenticated can insert/update/delete
CREATE POLICY "conflict_rules_write" ON public.vacation_conflict_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rule Members: All authenticated can read
CREATE POLICY "rule_members_read" ON public.vacation_conflict_rule_members
  FOR SELECT TO authenticated USING (true);

-- Rule Members: Authenticated can insert/update/delete
CREATE POLICY "rule_members_write" ON public.vacation_conflict_rule_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sub Rules: All authenticated can read
CREATE POLICY "sub_rules_read" ON public.vacation_conflict_sub_rules
  FOR SELECT TO authenticated USING (true);

-- Sub Rules: Authenticated can insert/update/delete
CREATE POLICY "sub_rules_write" ON public.vacation_conflict_sub_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTION: check_vacation_conflicts
-- Checks if scheduling an absence would violate conflict rules
-- Returns array of violations (empty if no conflicts)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_vacation_conflicts(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_situation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_rule RECORD;
  v_sub_rule RECORD;
  v_check_date DATE;
  v_absent_count INTEGER;
  v_absent_employees JSONB;
  v_violation JSONB;
  v_sub_absent_count INTEGER;
  v_sub_absent_employees JSONB;
  -- Situation type codes that trigger conflict checks (vacation + sick leave)
  v_trigger_codes TEXT[] := ARRAY['H', 'H1', 'H2', 'S'];
BEGIN
  -- Find all active rules that include this employee
  FOR v_rule IN
    SELECT
      r.id AS rule_id,
      r.name AS rule_name,
      r.max_absent,
      r.description AS rule_description
    FROM vacation_conflict_rules r
    INNER JOIN vacation_conflict_rule_members m ON m.rule_id = r.id
    WHERE m.employee_id = p_employee_id
      AND r.is_active = TRUE
  LOOP
    -- Check each date in the range
    v_check_date := p_start_date;
    WHILE v_check_date <= p_end_date LOOP
      -- Count how many rule members are already absent on this date
      SELECT
        COUNT(DISTINCT es.employee_id),
        COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'sigla', e.sigla
        )) FILTER (WHERE e.id IS NOT NULL), '[]'::JSONB)
      INTO v_absent_count, v_absent_employees
      FROM vacation_conflict_rule_members rm
      INNER JOIN employee_situations es ON es.employee_id = rm.employee_id
      INNER JOIN situation_types st ON st.id = es.situation_type_id
      INNER JOIN rh_employees e ON e.id = es.employee_id
      WHERE rm.rule_id = v_rule.rule_id
        AND rm.employee_id != p_employee_id  -- Don't count the employee we're checking
        AND st.code = ANY(v_trigger_codes)
        AND v_check_date BETWEEN es.start_date AND es.end_date
        AND (p_exclude_situation_id IS NULL OR es.id != p_exclude_situation_id);

      -- Check if adding this absence would exceed the limit
      IF (v_absent_count + 1) > v_rule.max_absent THEN
        v_violation := jsonb_build_object(
          'rule_id', v_rule.rule_id,
          'rule_name', v_rule.rule_name,
          'rule_description', v_rule.rule_description,
          'date', v_check_date,
          'max_absent', v_rule.max_absent,
          'current_absent_count', v_absent_count,
          'would_be_count', v_absent_count + 1,
          'absent_employees', v_absent_employees,
          'is_sub_rule', FALSE
        );

        -- Only add if not already in results (avoid duplicates)
        IF NOT v_result @> jsonb_build_array(v_violation) THEN
          v_result := v_result || jsonb_build_array(v_violation);
        END IF;
      END IF;

      v_check_date := v_check_date + INTERVAL '1 day';
    END LOOP;

    -- Check sub-rules for this rule
    FOR v_sub_rule IN
      SELECT
        sr.id AS sub_rule_id,
        sr.employee_ids,
        sr.max_absent AS sub_max_absent,
        sr.description AS sub_description
      FROM vacation_conflict_sub_rules sr
      WHERE sr.rule_id = v_rule.rule_id
        AND sr.is_active = TRUE
        AND p_employee_id = ANY(sr.employee_ids)
    LOOP
      -- Check each date for sub-rule violations
      v_check_date := p_start_date;
      WHILE v_check_date <= p_end_date LOOP
        -- Count how many sub-rule members are already absent
        SELECT
          COUNT(DISTINCT es.employee_id),
          COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'sigla', e.sigla
          )) FILTER (WHERE e.id IS NOT NULL), '[]'::JSONB)
        INTO v_sub_absent_count, v_sub_absent_employees
        FROM employee_situations es
        INNER JOIN situation_types st ON st.id = es.situation_type_id
        INNER JOIN rh_employees e ON e.id = es.employee_id
        WHERE es.employee_id = ANY(v_sub_rule.employee_ids)
          AND es.employee_id != p_employee_id
          AND st.code = ANY(v_trigger_codes)
          AND v_check_date BETWEEN es.start_date AND es.end_date
          AND (p_exclude_situation_id IS NULL OR es.id != p_exclude_situation_id);

        -- Check if adding this absence would exceed sub-rule limit
        IF (v_sub_absent_count + 1) > v_sub_rule.sub_max_absent THEN
          v_violation := jsonb_build_object(
            'rule_id', v_rule.rule_id,
            'rule_name', v_rule.rule_name,
            'sub_rule_id', v_sub_rule.sub_rule_id,
            'sub_rule_description', v_sub_rule.sub_description,
            'date', v_check_date,
            'max_absent', v_sub_rule.sub_max_absent,
            'current_absent_count', v_sub_absent_count,
            'would_be_count', v_sub_absent_count + 1,
            'absent_employees', v_sub_absent_employees,
            'is_sub_rule', TRUE
          );

          IF NOT v_result @> jsonb_build_array(v_violation) THEN
            v_result := v_result || jsonb_build_array(v_violation);
          END IF;
        END IF;

        v_check_date := v_check_date + INTERVAL '1 day';
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_vacation_conflicts(UUID, DATE, DATE, UUID) TO authenticated;

-- ============================================
-- FUNCTION: get_conflict_rules_with_members
-- Returns all rules with their members for UI display
-- ============================================
CREATE OR REPLACE FUNCTION public.get_conflict_rules_with_members()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'description', r.description,
      'max_absent', r.max_absent,
      'is_active', r.is_active,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'members', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'sigla', e.sigla,
            'departamento_id', e.departamento_id
          )
        )
        FROM vacation_conflict_rule_members m
        INNER JOIN rh_employees e ON e.id = m.employee_id
        WHERE m.rule_id = r.id
      ), '[]'::JSONB),
      'sub_rules', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sr.id,
            'employee_ids', sr.employee_ids,
            'max_absent', sr.max_absent,
            'description', sr.description,
            'is_active', sr.is_active,
            'employees', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', e2.id,
                  'name', e2.name,
                  'sigla', e2.sigla
                )
              )
              FROM rh_employees e2
              WHERE e2.id = ANY(sr.employee_ids)
            )
          )
        )
        FROM vacation_conflict_sub_rules sr
        WHERE sr.rule_id = r.id
      ), '[]'::JSONB)
    )
    ORDER BY r.name
  ), '[]'::JSONB)
  INTO v_result
  FROM vacation_conflict_rules r;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_conflict_rules_with_members() TO authenticated;
