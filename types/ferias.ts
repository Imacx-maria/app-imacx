// Vacation and Absence Management System - TypeScript Types

// ============================================
// Database Types
// ============================================

export interface SituationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  deducts_vacation: boolean;
  deduction_value: number;
  is_active: boolean;
  created_at: string;
}

export interface RHEmployee {
  id: string;
  sigla: string;
  name: string;
  email: string | null;
  departamento_id: number | null;
  admission_date: string;
  contract_type: "contract" | "freelancer";
  is_active: boolean;
  annual_vacation_days: number;
  previous_year_balance: number;
  current_year_used: number;
  current_year_total: number | null;
  user_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSituation {
  id: string;
  employee_id: string;
  situation_type_id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================
// Joined/Extended Types
// ============================================

export interface RHEmployeeWithDepartment extends RHEmployee {
  departamento?: {
    id: number;
    nome: string;
  } | null;
}

export interface EmployeeSituationWithDetails extends EmployeeSituation {
  employee?: RHEmployee;
  situation_type?: SituationType;
}

// ============================================
// Calendar Data Types
// ============================================

export interface CalendarDayData {
  employee_id: string;
  employee_name: string;
  employee_sigla: string;
  departamento_id: number | null;
  situation_date: string;
  situation_type_code: string;
  situation_type_name: string;
  is_half_day: boolean;
}

export interface CalendarMonthData {
  year: number;
  month: number;
  days: CalendarDayData[];
}

// ============================================
// Vacation Summary Types
// ============================================

export interface VacationSummary {
  employee_id: string;
  employee_name: string;
  employee_sigla: string;
  departamento_nome: string | null;
  contract_type: "contract" | "freelancer";
  admission_date: string;
  annual_days: number;
  previous_balance: number;
  current_total: number;
  current_used: number;
  remaining: number;
}

// ============================================
// Form Types
// ============================================

export interface CreateRHEmployeeInput {
  name: string;
  email?: string;
  departamento_id?: number;
  admission_date: string;
  contract_type: "contract" | "freelancer";
  annual_vacation_days?: number;
  user_profile_id?: string;
}

export interface UpdateRHEmployeeInput {
  id: string;
  name?: string;
  email?: string;
  departamento_id?: number | null;
  admission_date?: string;
  contract_type?: "contract" | "freelancer";
  is_active?: boolean;
  annual_vacation_days?: number;
  previous_year_balance?: number;
  current_year_total?: number;
  user_profile_id?: string | null;
}

export interface CreateSituationInput {
  employee_id: string;
  situation_type_id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  notes?: string;
}

export interface UpdateSituationInput {
  id: string;
  situation_type_id?: string;
  start_date?: string;
  end_date?: string;
  business_days?: number;
  notes?: string | null;
}

// ============================================
// Filter Types
// ============================================

export interface EmployeeFilters {
  search?: string;
  departamento_id?: number;
  contract_type?: "contract" | "freelancer";
  is_active?: boolean;
}

export interface SituationFilters {
  employee_id?: string;
  situation_type_id?: string;
  start_date?: string;
  end_date?: string;
  departamento_id?: number;
}

export interface CalendarFilters {
  year: number;
  month?: number;
  departamento_id?: number;
  employee_id?: string;
}

// ============================================
// Year Transition Types
// ============================================

export interface YearTransitionResult {
  employee_id: string;
  employee_name: string;
  previous_remaining: number;
  carry_over: number;
  new_entitlement: number;
}

// ============================================
// Dashboard/Stats Types
// ============================================

export interface VacationStats {
  total_employees: number;
  employees_on_vacation_today: number;
  employees_absent_today: number;
  average_remaining_days: number;
}

export interface DepartmentVacationSummary {
  departamento_id: number;
  departamento_nome: string;
  employee_count: number;
  total_entitled: number;
  total_used: number;
  total_remaining: number;
}

// ============================================
// Situation Type Code Constants
// ============================================

export const SITUATION_CODES = {
  VACATION: "H",
  VACATION_MORNING: "H1",
  VACATION_AFTERNOON: "H2",
  ABSENCE: "F",
  ABSENCE_MORNING: "F1",
  ABSENCE_AFTERNOON: "F2",
  /** @deprecated Use ABSENCE_MORNING (F1) instead. E records have been migrated to F1. */
  HALF_ABSENCE: "E",
  SICK_LEAVE: "S",
  PARENTAL_LEAVE: "M",
  COMPENSATION: "L",
  REMOTE_WORK: "W",
  HOLIDAY: "B",
  SYMPATHY: "C",
  OTHER: "N",
} as const;

export type SituationCode =
  (typeof SITUATION_CODES)[keyof typeof SITUATION_CODES];

// ============================================
// Contract Type Constants
// ============================================

export interface VacationPolicyDefaults {
  contract_default_days: number;
  freelancer_default_days: number;
}

export const CONTRACT_TYPES = {
  CONTRACT: "contract",
  FREELANCER: "freelancer",
} as const;

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  contract: "Contrato",
  freelancer: "Freelancer",
};

export const CONTRACT_TYPE_VACATION_DAYS: Record<string, number> = {
  contract: 22,
  freelancer: 11,
};

// ============================================
// Vacation Conflict Rules Types
// ============================================

export interface VacationConflictRule {
  id: string;
  name: string;
  description: string | null;
  max_absent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VacationConflictRuleMember {
  id: string;
  rule_id: string;
  employee_id: string;
  created_at: string;
}

export interface VacationConflictSubRule {
  id: string;
  rule_id: string;
  employee_ids: string[];
  max_absent: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// Extended types with joined data
export interface VacationConflictRuleWithMembers extends VacationConflictRule {
  members: Pick<RHEmployee, "id" | "name" | "sigla" | "departamento_id">[];
  sub_rules: VacationConflictSubRuleWithEmployees[];
}

export interface VacationConflictSubRuleWithEmployees extends VacationConflictSubRule {
  employees: Pick<RHEmployee, "id" | "name" | "sigla">[];
}

// Conflict check result types
export interface ConflictViolation {
  rule_id: string;
  rule_name: string;
  rule_description?: string | null;
  sub_rule_id?: string;
  sub_rule_description?: string | null;
  date: string;
  max_absent: number;
  current_absent_count: number;
  would_be_count: number;
  absent_employees: Pick<RHEmployee, "id" | "name" | "sigla">[];
  is_sub_rule: boolean;
}

export interface ConflictCheckResult {
  has_conflicts: boolean;
  violations: ConflictViolation[];
}

// Form input types
export interface CreateConflictRuleInput {
  name: string;
  description?: string;
  max_absent: number;
  member_ids: string[];
}

export interface UpdateConflictRuleInput {
  id: string;
  name?: string;
  description?: string | null;
  max_absent?: number;
  is_active?: boolean;
  member_ids?: string[];
}

export interface CreateSubRuleInput {
  rule_id: string;
  employee_ids: string[];
  max_absent: number;
  description?: string;
}

export interface UpdateSubRuleInput {
  id: string;
  employee_ids?: string[];
  max_absent?: number;
  description?: string | null;
  is_active?: boolean;
}
