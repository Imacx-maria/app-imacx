-- Vacation and Absence Management System - Tables Only
-- Created: 2025-12-10
-- Run this first, then run the functions file separately

-- ============================================
-- TABLE 1: situation_types (Absence/Situation Types)
-- ============================================
CREATE TABLE IF NOT EXISTS public.situation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  deducts_vacation BOOLEAN DEFAULT FALSE,
  deduction_value DECIMAL(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data for situation_types
-- Codes match the Excel vacation tracking spreadsheet
INSERT INTO public.situation_types (code, name, description, deducts_vacation, deduction_value) VALUES
  ('H', 'Ferias', 'Ferias anuais', true, 1.0),
  ('H1', 'Meio dia manha', 'Ferias meio dia - manha', true, 0.5),
  ('H2', 'Meio dia tarde', 'Ferias meio dia - tarde', true, 0.5),
  ('F', 'Falta', 'Falta injustificada', true, 1.0),
  ('E', 'Meia falta', 'Falta 1/2 dia', true, 0.5),
  ('S', 'Doenca', 'Baixa por doenca', false, 0),
  ('M', 'Maternidade', 'Licenca maternidade/paternidade', false, 0),
  ('L', 'Compensacao', 'Dia de compensacao', false, 0),
  ('W', 'Teletrabalho', 'Trabalho remoto', false, 0),
  ('B', 'Feriado', 'Feriado nacional/local', false, 0),
  ('C', 'Simpatia', 'Dia de simpatia', false, 0),
  ('N', 'Outro', 'Outro tipo de ausencia', false, 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- TABLE 2: rh_employees (HR Employee Records)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rh_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  departamento_id BIGINT REFERENCES public.departamentos(id),
  admission_date DATE NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('contract', 'freelancer')),
  is_active BOOLEAN DEFAULT TRUE,
  annual_vacation_days INTEGER NOT NULL DEFAULT 22,
  previous_year_balance DECIMAL(4,2) DEFAULT 0,
  current_year_used DECIMAL(4,2) DEFAULT 0,
  current_year_total DECIMAL(4,2),
  user_profile_id UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rh_employees_departamento ON public.rh_employees(departamento_id);
CREATE INDEX IF NOT EXISTS idx_rh_employees_active ON public.rh_employees(is_active);
CREATE INDEX IF NOT EXISTS idx_rh_employees_sigla ON public.rh_employees(sigla);

-- ============================================
-- TABLE 3: employee_situations (Absence Records)
-- ============================================
CREATE TABLE IF NOT EXISTS public.employee_situations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.rh_employees(id) ON DELETE CASCADE,
  situation_type_id UUID NOT NULL REFERENCES public.situation_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  business_days DECIMAL(5,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_situations_employee ON public.employee_situations(employee_id);
CREATE INDEX IF NOT EXISTS idx_situations_dates ON public.employee_situations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_situations_type ON public.employee_situations(situation_type_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.situation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_situations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "situation_types_read" ON public.situation_types;
DROP POLICY IF EXISTS "rh_employees_read" ON public.rh_employees;
DROP POLICY IF EXISTS "rh_employees_write" ON public.rh_employees;
DROP POLICY IF EXISTS "situations_read" ON public.employee_situations;
DROP POLICY IF EXISTS "situations_write" ON public.employee_situations;

-- Situation Types: All authenticated can read
CREATE POLICY "situation_types_read" ON public.situation_types
  FOR SELECT TO authenticated USING (true);

-- RH Employees: All authenticated can read
CREATE POLICY "rh_employees_read" ON public.rh_employees
  FOR SELECT TO authenticated USING (true);

-- RH Employees: Authenticated can insert/update/delete
CREATE POLICY "rh_employees_write" ON public.rh_employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee Situations: All authenticated can read
CREATE POLICY "situations_read" ON public.employee_situations
  FOR SELECT TO authenticated USING (true);

-- Employee Situations: Authenticated can insert/update/delete
CREATE POLICY "situations_write" ON public.employee_situations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
