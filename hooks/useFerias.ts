// Vacation and Absence System - React Hooks

import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserClient } from "@/utils/supabase";
import type {
  RHEmployee,
  RHEmployeeWithDepartment,
  EmployeeSituation,
  EmployeeSituationWithDetails,
  SituationType,
  CalendarDayData,
  VacationSummary,
  CreateRHEmployeeInput,
  UpdateRHEmployeeInput,
  CreateSituationInput,
  UpdateSituationInput,
  EmployeeFilters,
  SituationFilters,
  CalendarFilters,
  VacationConflictRule,
  VacationConflictRuleWithMembers,
  VacationConflictSubRule,
  ConflictViolation,
  ConflictCheckResult,
  CreateConflictRuleInput,
  UpdateConflictRuleInput,
  CreateSubRuleInput,
  UpdateSubRuleInput,
  VacationPolicyDefaults,
} from "@/types/ferias";

// ============================================
// useVacationPolicyDefaults Hook
// ============================================
export function useVacationPolicyDefaults() {
  const [policy, setPolicy] = useState<VacationPolicyDefaults>({
    contract_default_days: 22,
    freelancer_default_days: 11,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        "get_vacation_policy_defaults",
      );

      if (fetchError) throw fetchError;
      if (data) {
        setPolicy(data as VacationPolicyDefaults);
      }
    } catch (err: any) {
      console.error("Error fetching vacation defaults:", err);
      setError(err.message || "Erro ao carregar politica de ferias");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return {
    policy,
    loading,
    error,
    refresh: fetchPolicy,
  };
}

// ============================================
// useRHEmployees Hook
// ============================================
export function useRHEmployees(initialFilters?: EmployeeFilters) {
  const [employees, setEmployees] = useState<RHEmployeeWithDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmployeeFilters>(initialFilters || {});

  const supabase = useMemo(() => createBrowserClient(), []);

  // Update filters when initialFilters changes
  useEffect(() => {
    if (initialFilters !== undefined) {
      setFilters((prev) => {
        // Only update if filters actually changed (deep comparison)
        if (JSON.stringify(prev) === JSON.stringify(initialFilters)) {
          return prev;
        }
        return initialFilters;
      });
    }
  }, [initialFilters]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("rh_employees")
        .select(
          `
          *,
          departamento:departamentos(id, nome)
        `,
        )
        .order("name", { ascending: true });

      // Apply filters
      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }
      if (filters.departamento_id) {
        query = query.eq("departamento_id", filters.departamento_id);
      }
      if (filters.contract_type) {
        query = query.eq("contract_type", filters.contract_type);
      }
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,sigla.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
        );
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setEmployees(data || []);
    } catch (err: any) {
      console.error("Error fetching employees:", err);
      setError(err.message || "Erro ao carregar colaboradores");
    } finally {
      setLoading(false);
    }
  }, [supabase, filters]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = useCallback(
    async (input: CreateRHEmployeeInput) => {
      try {
        // Generate sigla first
        const { data: siglaData, error: siglaError } = await supabase.rpc(
          "generate_employee_sigla",
          { employee_name: input.name },
        );

        if (siglaError) throw siglaError;

        const sigla = siglaData as string;

        // Calculate current year total
        const currentYear = new Date().getFullYear();
        let contractDefault = 22;
        let freelancerDefault = 11;

        try {
          const { data: policyData } = await supabase.rpc(
            "get_vacation_policy_defaults",
          );
          if (policyData) {
            contractDefault =
              (policyData as VacationPolicyDefaults).contract_default_days ??
              contractDefault;
            freelancerDefault =
              (policyData as VacationPolicyDefaults).freelancer_default_days ??
              freelancerDefault;
          }
        } catch (policyErr) {
          console.warn("Falling back to static vacation defaults:", policyErr);
        }

        const annualDays =
          input.annual_vacation_days ??
          (input.contract_type === "contract"
            ? contractDefault
            : freelancerDefault);

        const { data: proratedData, error: proratedError } = await supabase.rpc(
          "calculate_prorated_vacation",
          {
            p_admission_date: input.admission_date,
            p_annual_days: annualDays,
            p_year: currentYear,
            p_contract_type: input.contract_type,
          },
        );

        if (proratedError) throw proratedError;

        const currentYearTotal = proratedData as number;

        // Insert employee
        const { data, error: insertError } = await supabase
          .from("rh_employees")
          .insert({
            ...input,
            sigla,
            annual_vacation_days: annualDays,
            current_year_total: currentYearTotal,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchEmployees();
        return data;
      } catch (err: any) {
        console.error("Error creating employee:", err);
        throw new Error(err.message || "Erro ao criar colaborador");
      }
    },
    [supabase, fetchEmployees],
  );

  const updateEmployee = useCallback(
    async (input: UpdateRHEmployeeInput) => {
      try {
        const { id, ...updateData } = input;

        const { data, error: updateError } = await supabase
          .from("rh_employees")
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (updateError) throw updateError;

        await fetchEmployees();
        return data;
      } catch (err: any) {
        console.error("Error updating employee:", err);
        throw new Error(err.message || "Erro ao atualizar colaborador");
      }
    },
    [supabase, fetchEmployees],
  );

  const deleteEmployee = useCallback(
    async (id: string) => {
      try {
        const { error: deleteError } = await supabase
          .from("rh_employees")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;

        await fetchEmployees();
      } catch (err: any) {
        console.error("Error deleting employee:", err);
        throw new Error(err.message || "Erro ao eliminar colaborador");
      }
    },
    [supabase, fetchEmployees],
  );

  return {
    employees,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

// ============================================
// useSituationTypes Hook
// ============================================
export function useSituationTypes() {
  const [situationTypes, setSituationTypes] = useState<SituationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchSituationTypes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("situation_types")
        .select("*")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (fetchError) throw fetchError;
      setSituationTypes(data || []);
    } catch (err: any) {
      console.error("Error fetching situation types:", err);
      setError(err.message || "Erro ao carregar tipos de situacao");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSituationTypes();
  }, [fetchSituationTypes]);

  // Group by deducts_vacation for UI
  const groupedTypes = useMemo(() => {
    const deducting = situationTypes.filter((t) => t.deducts_vacation);
    const nonDeducting = situationTypes.filter((t) => !t.deducts_vacation);
    return { deducting, nonDeducting };
  }, [situationTypes]);

  return {
    situationTypes,
    groupedTypes,
    loading,
    error,
    refresh: fetchSituationTypes,
  };
}

// ============================================
// useEmployeeSituations Hook
// ============================================
export function useEmployeeSituations(initialFilters?: SituationFilters) {
  const [situations, setSituations] = useState<EmployeeSituationWithDetails[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SituationFilters>(
    initialFilters || {},
  );

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchSituations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("employee_situations")
        .select(
          `
          *,
          employee:rh_employees(*),
          situation_type:situation_types(*)
        `,
        )
        .order("start_date", { ascending: false });

      // Apply filters
      if (filters.employee_id) {
        query = query.eq("employee_id", filters.employee_id);
      }
      if (filters.situation_type_id) {
        query = query.eq("situation_type_id", filters.situation_type_id);
      }
      if (filters.start_date) {
        query = query.gte("start_date", filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte("end_date", filters.end_date);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setSituations(data || []);
    } catch (err: any) {
      console.error("Error fetching situations:", err);
      setError(err.message || "Erro ao carregar situacoes");
    } finally {
      setLoading(false);
    }
  }, [supabase, filters]);

  useEffect(() => {
    fetchSituations();
  }, [fetchSituations]);

  const createSituation = useCallback(
    async (input: CreateSituationInput) => {
      try {
        const { data, error: insertError } = await supabase
          .from("employee_situations")
          .insert(input)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchSituations();
        return data;
      } catch (err: any) {
        console.error("Error creating situation:", err);
        throw new Error(err.message || "Erro ao registar ausencia");
      }
    },
    [supabase, fetchSituations],
  );

  const updateSituation = useCallback(
    async (input: UpdateSituationInput) => {
      try {
        const { id, ...updateData } = input;

        const { data, error: updateError } = await supabase
          .from("employee_situations")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) throw updateError;

        await fetchSituations();
        return data;
      } catch (err: any) {
        console.error("Error updating situation:", err);
        throw new Error(err.message || "Erro ao atualizar ausencia");
      }
    },
    [supabase, fetchSituations],
  );

  const deleteSituation = useCallback(
    async (id: string) => {
      try {
        const { error: deleteError } = await supabase
          .from("employee_situations")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;

        await fetchSituations();
      } catch (err: any) {
        console.error("Error deleting situation:", err);
        throw new Error(err.message || "Erro ao eliminar ausencia");
      }
    },
    [supabase, fetchSituations],
  );

  return {
    situations,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchSituations,
    createSituation,
    updateSituation,
    deleteSituation,
  };
}

// ============================================
// useCalendarData Hook
// ============================================
export function useCalendarData(
  initialFilters: CalendarFilters,
  options?: { includeNextQuarter?: boolean },
) {
  const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>(initialFilters);

  const supabase = useMemo(() => createBrowserClient(), []);

  // Update filters when initialFilters changes
  // Use individual values as dependencies to avoid object reference issues
  useEffect(() => {
    setFilters({
      year: initialFilters.year,
      month: initialFilters.month,
      departamento_id: initialFilters.departamento_id,
      employee_id: initialFilters.employee_id,
    });
  }, [
    initialFilters.year,
    initialFilters.month,
    initialFilters.departamento_id,
    initialFilters.employee_id,
  ]);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const request = {
        p_year: filters.year,
        p_month: filters.month || null,
        p_department_id: filters.departamento_id || null,
        p_employee_id: filters.employee_id || null,
      };

      const baseResponse = await supabase.rpc(
        "get_employee_calendar_data",
        request,
      );

      if (baseResponse.error) throw baseResponse.error;

      let merged = (baseResponse.data || []) as CalendarDayData[];

      const shouldIncludeNextQuarter =
        options?.includeNextQuarter === true && !filters.month;

      if (shouldIncludeNextQuarter) {
        const nextYear = filters.year + 1;
        const [jan, feb, mar] = await Promise.all([
          supabase.rpc("get_employee_calendar_data", {
            ...request,
            p_year: nextYear,
            p_month: 1,
          }),
          supabase.rpc("get_employee_calendar_data", {
            ...request,
            p_year: nextYear,
            p_month: 2,
          }),
          supabase.rpc("get_employee_calendar_data", {
            ...request,
            p_year: nextYear,
            p_month: 3,
          }),
        ]);

        if (jan.error) throw jan.error;
        if (feb.error) throw feb.error;
        if (mar.error) throw mar.error;

        merged = merged.concat(
          ((jan.data || []) as CalendarDayData[]).concat(
            (feb.data || []) as CalendarDayData[],
            (mar.data || []) as CalendarDayData[],
          ),
        );

        merged.sort((a, b) => {
          const byName = a.employee_name.localeCompare(b.employee_name);
          if (byName !== 0) return byName;
          return a.situation_date.localeCompare(b.situation_date);
        });
      }

      setCalendarData(merged);
    } catch (err: any) {
      console.error("Error fetching calendar data:", err);
      setError(err.message || "Erro ao carregar dados do calendario");
    } finally {
      setLoading(false);
    }
  }, [supabase, filters, options?.includeNextQuarter]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Group data by date for calendar display
  const dataByDate = useMemo(() => {
    const grouped: Record<string, CalendarDayData[]> = {};
    calendarData.forEach((item) => {
      if (!grouped[item.situation_date]) {
        grouped[item.situation_date] = [];
      }
      grouped[item.situation_date].push(item);
    });
    return grouped;
  }, [calendarData]);

  // Group data by employee for timeline view
  const dataByEmployee = useMemo(() => {
    const grouped: Record<string, CalendarDayData[]> = {};
    calendarData.forEach((item) => {
      if (!grouped[item.employee_id]) {
        grouped[item.employee_id] = [];
      }
      grouped[item.employee_id].push(item);
    });
    return grouped;
  }, [calendarData]);

  return {
    calendarData,
    dataByDate,
    dataByEmployee,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchCalendarData,
  };
}

// ============================================
// useVacationSummary Hook
// ============================================
export function useVacationSummary(departamentoId?: number) {
  const [summary, setSummary] = useState<VacationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const currentYear = new Date().getFullYear();
      const { data, error: fetchError } = await supabase.rpc(
        "get_vacation_summary",
        {
          p_year: currentYear,
          p_department_id: departamentoId || null,
        },
      );

      if (fetchError) throw fetchError;
      setSummary(data || []);
    } catch (err: any) {
      console.error("Error fetching vacation summary:", err);
      setError(err.message || "Erro ao carregar resumo de ferias");
    } finally {
      setLoading(false);
    }
  }, [supabase, departamentoId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Calculate totals
  const totals = useMemo(() => {
    return summary.reduce(
      (acc, emp) => ({
        totalEntitled:
          acc.totalEntitled + emp.previous_balance + emp.current_total,
        totalUsed: acc.totalUsed + emp.current_used,
        totalRemaining: acc.totalRemaining + emp.remaining,
      }),
      { totalEntitled: 0, totalUsed: 0, totalRemaining: 0 },
    );
  }, [summary]);

  return {
    summary,
    totals,
    loading,
    error,
    refresh: fetchSummary,
  };
}

// ============================================
// useHolidays Hook (uses existing feriados table)
// ============================================
export function useHolidays(
  year?: number,
  options?: { includeNextQuarter?: boolean },
) {
  const [holidays, setHolidays] = useState<
    { id: string; holiday_date: string; description: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseYear = year ?? new Date().getFullYear();
      const [{ error: ensureError1 }, { error: ensureError2 }] =
        await Promise.all([
          supabase.rpc("ensure_pt_national_holidays", { p_year: baseYear }),
          supabase.rpc("ensure_pt_national_holidays", { p_year: baseYear + 1 }),
        ]);

      if (ensureError1) throw ensureError1;
      if (ensureError2) throw ensureError2;

      let query = supabase
        .from("feriados")
        .select("*")
        .order("holiday_date", { ascending: true });

      if (year) {
        const startDate = `${year}-01-01`;
        const currentYear = new Date().getFullYear();
        const shouldIncludeNextQuarter =
          options?.includeNextQuarter === true && year === currentYear;
        const endDate = shouldIncludeNextQuarter
          ? `${year + 1}-03-31`
          : `${year}-12-31`;
        query = query
          .gte("holiday_date", startDate)
          .lte("holiday_date", endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setHolidays(data || []);
    } catch (err: any) {
      console.error("Error fetching holidays:", err);
      setError(err.message || "Erro ao carregar feriados");
    } finally {
      setLoading(false);
    }
  }, [supabase, year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Create a Set of holiday dates for quick lookup
  const holidayDates = useMemo(() => {
    return new Set(holidays.map((h) => h.holiday_date));
  }, [holidays]);

  const isHoliday = useCallback(
    (date: Date | string): boolean => {
      const dateStr =
        typeof date === "string" ? date : date.toISOString().split("T")[0];
      return holidayDates.has(dateStr);
    },
    [holidayDates],
  );

  const getHolidayName = useCallback(
    (date: Date | string): string | null => {
      const dateStr =
        typeof date === "string" ? date : date.toISOString().split("T")[0];
      const holiday = holidays.find((h) => h.holiday_date === dateStr);
      return holiday?.description || null;
    },
    [holidays],
  );

  return {
    holidays,
    holidayDates,
    loading,
    error,
    isHoliday,
    getHolidayName,
    refresh: fetchHolidays,
  };
}

// ============================================
// useDepartamentos Hook
// ============================================
export function useDepartamentos() {
  const [departamentos, setDepartamentos] = useState<
    { id: number; nome: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchDepartamentos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("active", true)
        .order("nome", { ascending: true });

      if (fetchError) throw fetchError;
      setDepartamentos(data || []);
    } catch (err: any) {
      console.error("Error fetching departamentos:", err);
      setError(err.message || "Erro ao carregar departamentos");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  return {
    departamentos,
    loading,
    error,
    refresh: fetchDepartamentos,
  };
}

// ============================================
// useBusinessDays Hook
// ============================================
export function useBusinessDays() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const calculateBusinessDays = useCallback(
    async (startDate: string, endDate: string): Promise<number> => {
      try {
        const { data, error } = await supabase.rpc("calculate_working_days", {
          start_date: startDate,
          end_date: endDate,
        });

        if (error) throw error;
        return data as number;
      } catch (err: any) {
        console.error("Error calculating business days:", err);
        throw new Error(err.message || "Erro ao calcular dias uteis");
      }
    },
    [supabase],
  );

  return { calculateBusinessDays };
}

// ============================================
// useEmployeeVacationBalance Hook
// Get a single employee's vacation balance for validation
// ============================================
export interface EmployeeVacationBalance {
  employee_id: string;
  previous_balance: number;
  current_total: number;
  current_used: number;
  remaining: number;
}

export function useEmployeeVacationBalance(employeeId: string | null) {
  const [balance, setBalance] = useState<EmployeeVacationBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchBalance = useCallback(async () => {
    if (!employeeId) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get employee data
      const { data: employee, error: empError } = await supabase
        .from("rh_employees")
        .select(
          "id, previous_year_balance, current_year_total, current_year_used",
        )
        .eq("id", employeeId)
        .single();

      if (empError) throw empError;

      const previousBalance = employee.previous_year_balance || 0;
      const currentTotal = employee.current_year_total || 0;
      const currentUsed = employee.current_year_used || 0;
      const remaining = previousBalance + currentTotal - currentUsed;

      setBalance({
        employee_id: employee.id,
        previous_balance: previousBalance,
        current_total: currentTotal,
        current_used: currentUsed,
        remaining,
      });
    } catch (err: any) {
      console.error("Error fetching employee balance:", err);
      setError(err.message || "Erro ao carregar saldo de ferias");
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, employeeId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    loading,
    error,
    refresh: fetchBalance,
  };
}

// ============================================
// useVacationConflictRules Hook
// ============================================
export function useVacationConflictRules() {
  const [rules, setRules] = useState<VacationConflictRuleWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        "get_conflict_rules_with_members",
      );

      if (fetchError) throw fetchError;
      setRules((data as VacationConflictRuleWithMembers[]) || []);
    } catch (err: any) {
      console.error("Error fetching conflict rules:", err);
      setError(err.message || "Erro ao carregar regras de conflito");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(
    async (input: CreateConflictRuleInput) => {
      try {
        // Insert the rule
        const { data: ruleData, error: ruleError } = await supabase
          .from("vacation_conflict_rules")
          .insert({
            name: input.name,
            description: input.description || null,
            max_absent: input.max_absent,
          })
          .select()
          .single();

        if (ruleError) throw ruleError;

        // Insert rule members
        if (input.member_ids.length > 0) {
          const members = input.member_ids.map((employee_id) => ({
            rule_id: ruleData.id,
            employee_id,
          }));

          const { error: membersError } = await supabase
            .from("vacation_conflict_rule_members")
            .insert(members);

          if (membersError) throw membersError;
        }

        await fetchRules();
        return ruleData;
      } catch (err: any) {
        console.error("Error creating conflict rule:", err);
        throw new Error(err.message || "Erro ao criar regra de conflito");
      }
    },
    [supabase, fetchRules],
  );

  const updateRule = useCallback(
    async (input: UpdateConflictRuleInput) => {
      try {
        const { id, member_ids, ...updateData } = input;

        // Update rule fields
        const { error: updateError } = await supabase
          .from("vacation_conflict_rules")
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (updateError) throw updateError;

        // Update members if provided
        if (member_ids !== undefined) {
          // Delete existing members
          const { error: deleteError } = await supabase
            .from("vacation_conflict_rule_members")
            .delete()
            .eq("rule_id", id);

          if (deleteError) throw deleteError;

          // Insert new members
          if (member_ids.length > 0) {
            const members = member_ids.map((employee_id) => ({
              rule_id: id,
              employee_id,
            }));

            const { error: membersError } = await supabase
              .from("vacation_conflict_rule_members")
              .insert(members);

            if (membersError) throw membersError;
          }
        }

        await fetchRules();
      } catch (err: any) {
        console.error("Error updating conflict rule:", err);
        throw new Error(err.message || "Erro ao atualizar regra de conflito");
      }
    },
    [supabase, fetchRules],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      try {
        const { error: deleteError } = await supabase
          .from("vacation_conflict_rules")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;

        await fetchRules();
      } catch (err: any) {
        console.error("Error deleting conflict rule:", err);
        throw new Error(err.message || "Erro ao eliminar regra de conflito");
      }
    },
    [supabase, fetchRules],
  );

  // Sub-rule operations
  const createSubRule = useCallback(
    async (input: CreateSubRuleInput) => {
      try {
        const { data, error: insertError } = await supabase
          .from("vacation_conflict_sub_rules")
          .insert({
            rule_id: input.rule_id,
            employee_ids: input.employee_ids,
            max_absent: input.max_absent,
            description: input.description || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchRules();
        return data;
      } catch (err: any) {
        console.error("Error creating sub-rule:", err);
        throw new Error(err.message || "Erro ao criar sub-regra");
      }
    },
    [supabase, fetchRules],
  );

  const updateSubRule = useCallback(
    async (input: UpdateSubRuleInput) => {
      try {
        const { id, ...updateData } = input;

        const { error: updateError } = await supabase
          .from("vacation_conflict_sub_rules")
          .update(updateData)
          .eq("id", id);

        if (updateError) throw updateError;

        await fetchRules();
      } catch (err: any) {
        console.error("Error updating sub-rule:", err);
        throw new Error(err.message || "Erro ao atualizar sub-regra");
      }
    },
    [supabase, fetchRules],
  );

  const deleteSubRule = useCallback(
    async (id: string) => {
      try {
        const { error: deleteError } = await supabase
          .from("vacation_conflict_sub_rules")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;

        await fetchRules();
      } catch (err: any) {
        console.error("Error deleting sub-rule:", err);
        throw new Error(err.message || "Erro ao eliminar sub-regra");
      }
    },
    [supabase, fetchRules],
  );

  return {
    rules,
    loading,
    error,
    refresh: fetchRules,
    createRule,
    updateRule,
    deleteRule,
    createSubRule,
    updateSubRule,
    deleteSubRule,
  };
}

// ============================================
// useConflictCheck Hook
// ============================================
export function useConflictCheck() {
  const [checking, setChecking] = useState(false);
  const supabase = useMemo(() => createBrowserClient(), []);

  const checkConflicts = useCallback(
    async (
      employeeId: string,
      startDate: string,
      endDate: string,
      excludeSituationId?: string,
    ): Promise<ConflictCheckResult> => {
      setChecking(true);
      try {
        const { data, error } = await supabase.rpc("check_vacation_conflicts", {
          p_employee_id: employeeId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_exclude_situation_id: excludeSituationId || null,
        });

        if (error) throw error;

        const violations = (data as ConflictViolation[]) || [];
        return {
          has_conflicts: violations.length > 0,
          violations,
        };
      } catch (err: any) {
        console.error("Error checking conflicts:", err);
        throw new Error(err.message || "Erro ao verificar conflitos");
      } finally {
        setChecking(false);
      }
    },
    [supabase],
  );

  return { checkConflicts, checking };
}

// ============================================
// useOverlapCheck Hook
// Check if employee already has an absence registered for the given dates
// ============================================
export interface OverlapResult {
  has_overlap: boolean;
  overlapping_situations: {
    id: string;
    start_date: string;
    end_date: string;
    situation_type_code: string;
    situation_type_name: string;
    business_days: number;
  }[];
}

export function useOverlapCheck() {
  const [checking, setChecking] = useState(false);
  const supabase = useMemo(() => createBrowserClient(), []);

  const checkOverlap = useCallback(
    async (
      employeeId: string,
      startDate: string,
      endDate: string,
      excludeSituationId?: string,
    ): Promise<OverlapResult> => {
      setChecking(true);
      try {
        // Find any existing situations that overlap with the given date range
        let query = supabase
          .from("employee_situations")
          .select(
            `
            id,
            start_date,
            end_date,
            business_days,
            situation_types!inner (
              code,
              name
            )
          `,
          )
          .eq("employee_id", employeeId)
          .lte("start_date", endDate)
          .gte("end_date", startDate);

        // Exclude current situation if editing
        if (excludeSituationId) {
          query = query.neq("id", excludeSituationId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const overlapping = (data || []).map((item: any) => ({
          id: item.id,
          start_date: item.start_date,
          end_date: item.end_date,
          situation_type_code: item.situation_types.code,
          situation_type_name: item.situation_types.name,
          business_days: item.business_days,
        }));

        return {
          has_overlap: overlapping.length > 0,
          overlapping_situations: overlapping,
        };
      } catch (err: any) {
        console.error("Error checking overlap:", err);
        throw new Error(err.message || "Erro ao verificar sobreposicao");
      } finally {
        setChecking(false);
      }
    },
    [supabase],
  );

  return { checkOverlap, checking };
}
