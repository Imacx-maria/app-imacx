"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  useEmployeeSituations,
  useRHEmployees,
  useSituationTypes,
  useBusinessDays,
  useConflictCheck,
  useOverlapCheck,
  useEmployeeVacationBalance,
} from "@/hooks/useFerias";
import DatePicker from "@/components/ui/DatePicker";
import ConflictWarningDialog from "./ConflictWarningDialog";
import OverlapWarningDialog from "./OverlapWarningDialog";
import InsufficientBalanceDialog from "./InsufficientBalanceDialog";
import EligibilityWarningDialog from "./EligibilityWarningDialog";
import type {
  EmployeeSituationWithDetails,
  CreateSituationInput,
  UpdateSituationInput,
  ConflictViolation,
} from "@/types/ferias";
import { formatVacationBalance } from "@/utils/ferias/vacationHelpers";
import { SITUATION_CODES } from "@/types/ferias";

// Situation codes that trigger conflict checks (vacation + sick leave)
const CONFLICT_TRIGGER_CODES = ["H", "H1", "H2", "S"];

interface AbsenceFormProps {
  situation?: EmployeeSituationWithDetails | null;
  preselectedEmployeeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AbsenceForm({
  situation,
  preselectedEmployeeId,
  onSuccess,
  onCancel,
}: AbsenceFormProps) {
  const isEditing = !!situation;

  // Form state
  const [employeeId, setEmployeeId] = useState(
    situation?.employee_id || preselectedEmployeeId || "",
  );
  const [situationTypeId, setSituationTypeId] = useState(
    situation?.situation_type_id || "",
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    situation?.start_date ? new Date(situation.start_date) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    situation?.end_date ? new Date(situation.end_date) : undefined,
  );
  const [businessDays, setBusinessDays] = useState<number>(
    situation?.business_days || 0,
  );
  const [notes, setNotes] = useState(situation?.notes || "");

  const [submitting, setSubmitting] = useState(false);
  const [calculatingDays, setCalculatingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conflict checking state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictViolations, setConflictViolations] = useState<
    ConflictViolation[]
  >([]);
  const [bypassConflictCheck, setBypassConflictCheck] = useState(false);

  // Overlap checking state
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [overlappingSituations, setOverlappingSituations] = useState<
    {
      id: string;
      start_date: string;
      end_date: string;
      situation_type_code: string;
      situation_type_name: string;
      business_days: number;
    }[]
  >([]);
  const [bypassOverlapCheck, setBypassOverlapCheck] = useState(false);

  // Insufficient balance checking state
  const [showInsufficientBalanceDialog, setShowInsufficientBalanceDialog] =
    useState(false);
  const [bypassBalanceCheck, setBypassBalanceCheck] = useState(false);

  // Eligibility warning state (6-month rule)
  const [showEligibilityWarning, setShowEligibilityWarning] = useState(false);
  const [bypassEligibilityCheck, setBypassEligibilityCheck] = useState(false);
  const [eligibilityDateState, setEligibilityDateState] = useState<Date | null>(
    null,
  );

  // Hooks
  const { createSituation, updateSituation } = useEmployeeSituations();
  const { employees } = useRHEmployees({ is_active: true });
  const { situationTypes, groupedTypes } = useSituationTypes();
  const { calculateBusinessDays } = useBusinessDays();
  const { checkConflicts, checking: checkingConflicts } = useConflictCheck();
  const { checkOverlap, checking: checkingOverlap } = useOverlapCheck();
  const { balance: employeeBalance } = useEmployeeVacationBalance(
    employeeId || null,
  );

  // Get selected situation type for deduction info
  const selectedType = useMemo(() => {
    return situationTypes.find((t) => t.id === situationTypeId);
  }, [situationTypes, situationTypeId]);

  // Calculate business days when dates change
  useEffect(() => {
    const calc = async () => {
      if (!startDate || !endDate) {
        setBusinessDays(0);
        return;
      }

      if (endDate < startDate) {
        setBusinessDays(0);
        return;
      }

      setCalculatingDays(true);
      try {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        const days = await calculateBusinessDays(startStr, endStr);

        // Apply deduction value if half-day type
        if (selectedType && selectedType.deduction_value === 0.5) {
          setBusinessDays(days * 0.5);
        } else {
          setBusinessDays(days);
        }
      } catch (err) {
        console.error("Error calculating business days:", err);
        // Fallback to simple calculation
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setBusinessDays(diffDays);
      } finally {
        setCalculatingDays(false);
      }
    };

    calc();
  }, [startDate, endDate, selectedType, calculateBusinessDays]);

  // Check if current situation type triggers conflict checks
  const shouldCheckConflicts = useMemo(() => {
    if (!selectedType) return false;
    return CONFLICT_TRIGGER_CODES.includes(selectedType.code);
  }, [selectedType]);

  // Get selected employee for dialog display
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === employeeId);
  }, [employees, employeeId]);

  // Perform the actual save
  const performSave = async (deleteOverlapping: boolean = false) => {
    setSubmitting(true);
    try {
      // If replacing, delete overlapping situations first
      if (deleteOverlapping && overlappingSituations.length > 0) {
        const { createBrowserClient } = await import("@/utils/supabase");
        const supabase = createBrowserClient();

        for (const sit of overlappingSituations) {
          await supabase.from("employee_situations").delete().eq("id", sit.id);
        }
      }

      if (isEditing && situation) {
        const updateData: UpdateSituationInput = {
          id: situation.id,
          situation_type_id: situationTypeId,
          start_date: startDate!.toISOString().split("T")[0],
          end_date: endDate!.toISOString().split("T")[0],
          business_days: businessDays,
          notes: notes.trim() || null,
        };
        await updateSituation(updateData);
      } else {
        const createData: CreateSituationInput = {
          employee_id: employeeId,
          situation_type_id: situationTypeId,
          start_date: startDate!.toISOString().split("T")[0],
          end_date: endDate!.toISOString().split("T")[0],
          business_days: businessDays,
          notes: notes.trim() || undefined,
        };
        await createSituation(createData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Erro ao guardar ausencia");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!employeeId) {
      setError("Selecione um colaborador");
      return;
    }
    if (!situationTypeId) {
      setError("Selecione o tipo de ausencia");
      return;
    }
    if (!startDate) {
      setError("Selecione a data de inicio");
      return;
    }
    if (!endDate) {
      setError("Selecione a data de fim");
      return;
    }
    if (endDate < startDate) {
      setError("A data de fim deve ser igual ou posterior a data de inicio");
      return;
    }

    // Vacation can only be taken after 6 months of service (Portuguese law)
    // This is now a warning that can be bypassed
    const isVacationType =
      selectedType &&
      [
        SITUATION_CODES.VACATION,
        SITUATION_CODES.VACATION_MORNING,
        SITUATION_CODES.VACATION_AFTERNOON,
      ].includes(selectedType.code as "H" | "H1" | "H2");

    if (
      isVacationType &&
      selectedEmployee?.contract_type === "contract" &&
      selectedEmployee?.admission_date &&
      !bypassEligibilityCheck
    ) {
      const eligibilityDate = new Date(selectedEmployee.admission_date);
      eligibilityDate.setMonth(eligibilityDate.getMonth() + 6);

      if (startDate < eligibilityDate) {
        setEligibilityDateState(eligibilityDate);
        setShowEligibilityWarning(true);
        return;
      }
    }

    // Check for overlapping dates first (unless bypassed)
    if (!bypassOverlapCheck) {
      try {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        const excludeId = isEditing ? situation?.id : undefined;

        const overlapResult = await checkOverlap(
          employeeId,
          startStr,
          endStr,
          excludeId,
        );

        if (overlapResult.has_overlap) {
          setOverlappingSituations(overlapResult.overlapping_situations);
          setShowOverlapDialog(true);
          return;
        }
      } catch (err: any) {
        console.error("Error checking overlap:", err);
        // Continue with save even if overlap check fails
      }
    }

    // Check for insufficient vacation balance (unless bypassed)
    // Only check for vacation types that deduct from balance
    if (
      isVacationType &&
      selectedType?.deducts_vacation &&
      !bypassBalanceCheck
    ) {
      if (employeeBalance) {
        const deductionDays =
          businessDays * (selectedType.deduction_value || 1);
        const resultingBalance = employeeBalance.remaining - deductionDays;

        if (resultingBalance < 0) {
          setShowInsufficientBalanceDialog(true);
          return;
        }
      }
    }

    // Check for conflicts if this is a triggering situation type and not bypassed
    if (shouldCheckConflicts && !bypassConflictCheck) {
      try {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        const excludeId = isEditing ? situation?.id : undefined;

        const result = await checkConflicts(
          employeeId,
          startStr,
          endStr,
          excludeId,
        );

        if (result.has_conflicts) {
          setConflictViolations(result.violations);
          setShowConflictDialog(true);
          return;
        }
      } catch (err: any) {
        console.error("Error checking conflicts:", err);
        // Continue with save even if conflict check fails
      }
    }

    // No conflicts or bypassed, proceed with save
    await performSave();
  };

  // Handle proceeding despite conflicts
  const handleProceedWithConflicts = async () => {
    setShowConflictDialog(false);
    setBypassConflictCheck(true);
    await performSave();
    setBypassConflictCheck(false);
  };

  // Handle canceling due to conflicts
  const handleCancelConflict = () => {
    setShowConflictDialog(false);
    setConflictViolations([]);
  };

  // Handle replacing overlapping situations
  const handleReplaceOverlap = async () => {
    setShowOverlapDialog(false);
    setBypassOverlapCheck(true);
    await performSave(true); // true = delete overlapping
    setBypassOverlapCheck(false);
    setOverlappingSituations([]);
  };

  // Handle canceling due to overlap
  const handleCancelOverlap = () => {
    setShowOverlapDialog(false);
    setOverlappingSituations([]);
  };

  // Handle proceeding despite insufficient balance
  const handleProceedWithInsufficientBalance = async () => {
    setShowInsufficientBalanceDialog(false);
    setBypassBalanceCheck(true);
    await performSave();
    setBypassBalanceCheck(false);
  };

  // Handle canceling due to insufficient balance
  const handleCancelInsufficientBalance = () => {
    setShowInsufficientBalanceDialog(false);
  };

  // Handle proceeding despite eligibility warning (6-month rule)
  const handleProceedWithEligibility = async () => {
    setShowEligibilityWarning(false);
    // Set bypass and then trigger a re-validation by calling performSave directly
    // Since eligibility is the first check, we can safely proceed to remaining checks

    // Check for overlapping dates
    if (!bypassOverlapCheck && startDate && endDate) {
      try {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        const excludeId = isEditing ? situation?.id : undefined;

        const overlapResult = await checkOverlap(
          employeeId,
          startStr,
          endStr,
          excludeId,
        );

        if (overlapResult.has_overlap) {
          setOverlappingSituations(overlapResult.overlapping_situations);
          setShowOverlapDialog(true);
          setBypassEligibilityCheck(true); // Keep bypassed for next attempt
          return;
        }
      } catch (err: any) {
        console.error("Error checking overlap:", err);
      }
    }

    // Check for insufficient vacation balance
    const isVacationType =
      selectedType &&
      [
        SITUATION_CODES.VACATION,
        SITUATION_CODES.VACATION_MORNING,
        SITUATION_CODES.VACATION_AFTERNOON,
      ].includes(selectedType.code as "H" | "H1" | "H2");

    if (
      isVacationType &&
      selectedType?.deducts_vacation &&
      !bypassBalanceCheck &&
      employeeBalance
    ) {
      const deductionDays = businessDays * (selectedType.deduction_value || 1);
      const resultingBalance = employeeBalance.remaining - deductionDays;

      if (resultingBalance < 0) {
        setShowInsufficientBalanceDialog(true);
        setBypassEligibilityCheck(true); // Keep bypassed for next attempt
        return;
      }
    }

    // Check for conflicts
    if (shouldCheckConflicts && !bypassConflictCheck && startDate && endDate) {
      try {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        const excludeId = isEditing ? situation?.id : undefined;

        const result = await checkConflicts(
          employeeId,
          startStr,
          endStr,
          excludeId,
        );

        if (result.has_conflicts) {
          setConflictViolations(result.violations);
          setShowConflictDialog(true);
          setBypassEligibilityCheck(true); // Keep bypassed for next attempt
          return;
        }
      } catch (err: any) {
        console.error("Error checking conflicts:", err);
      }
    }

    // All checks passed, save
    await performSave();
  };

  // Handle canceling due to eligibility warning
  const handleCancelEligibility = () => {
    setShowEligibilityWarning(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="employee">Colaborador *</Label>
        <Select
          value={employeeId}
          onValueChange={setEmployeeId}
          disabled={submitting || isEditing}
        >
          <SelectTrigger id="employee">
            <SelectValue placeholder="Selecionar colaborador" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.sigla} - {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="situationType">Tipo de Ausencia *</Label>
        <Select
          value={situationTypeId}
          onValueChange={setSituationTypeId}
          disabled={submitting}
        >
          <SelectTrigger id="situationType">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {groupedTypes.deducting.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Deduz Ferias
                </div>
                {groupedTypes.deducting.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.code} - {type.name}
                    {type.deduction_value === 0.5 && " (meio dia)"}
                  </SelectItem>
                ))}
              </>
            )}
            {groupedTypes.nonDeducting.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs text-muted-foreground imx-border-t mt-1">
                  Nao Deduz Ferias
                </div>
                {groupedTypes.nonDeducting.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        {selectedType && (
          <p className="text-xs text-muted-foreground">
            {selectedType.deducts_vacation
              ? `Deduz ${selectedType.deduction_value} dia(s) por dia util`
              : "Nao deduz do saldo de ferias"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Inicio *</Label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-2">
          <Label>Data Fim *</Label>
          <DatePicker value={endDate} onChange={setEndDate} />
        </div>
      </div>

      <div className="rounded-md bg-muted p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Dias Uteis:</span>
          <span className="text-lg">
            {calculatingDays ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              formatVacationBalance(businessDays)
            )}
          </span>
        </div>
        {selectedType?.deducts_vacation && businessDays > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Serao deduzidos{" "}
            {formatVacationBalance(businessDays * selectedType.deduction_value)}{" "}
            dia(s) do saldo de ferias
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observacoes (opcional)"
          disabled={submitting}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting || checkingConflicts || checkingOverlap}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={
            submitting ||
            calculatingDays ||
            checkingConflicts ||
            checkingOverlap
          }
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar...
            </>
          ) : checkingConflicts || checkingOverlap ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />A verificar...
            </>
          ) : isEditing ? (
            "Guardar"
          ) : (
            "Registar"
          )}
        </Button>
      </div>

      {/* Conflict Warning Dialog */}
      <ConflictWarningDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        violations={conflictViolations}
        employeeName={selectedEmployee?.name || ""}
        startDate={startDate?.toISOString().split("T")[0] || ""}
        endDate={endDate?.toISOString().split("T")[0] || ""}
        onProceed={handleProceedWithConflicts}
        onCancel={handleCancelConflict}
      />

      {/* Overlap Warning Dialog */}
      <OverlapWarningDialog
        open={showOverlapDialog}
        onOpenChange={setShowOverlapDialog}
        overlappingSituations={overlappingSituations}
        employeeName={selectedEmployee?.name || ""}
        onReplace={handleReplaceOverlap}
        onCancel={handleCancelOverlap}
      />

      {/* Insufficient Balance Warning Dialog */}
      <InsufficientBalanceDialog
        open={showInsufficientBalanceDialog}
        onOpenChange={setShowInsufficientBalanceDialog}
        employeeName={selectedEmployee?.name || ""}
        startDate={startDate?.toISOString().split("T")[0] || ""}
        endDate={endDate?.toISOString().split("T")[0] || ""}
        requestedDays={businessDays * (selectedType?.deduction_value || 1)}
        currentBalance={employeeBalance?.remaining || 0}
        resultingBalance={
          (employeeBalance?.remaining || 0) -
          businessDays * (selectedType?.deduction_value || 1)
        }
        onProceed={handleProceedWithInsufficientBalance}
        onCancel={handleCancelInsufficientBalance}
      />

      {/* Eligibility Warning Dialog (6-month rule) */}
      <EligibilityWarningDialog
        open={showEligibilityWarning}
        onOpenChange={setShowEligibilityWarning}
        employeeName={selectedEmployee?.name || ""}
        admissionDate={selectedEmployee?.admission_date || ""}
        eligibilityDate={eligibilityDateState || new Date()}
        onProceed={handleProceedWithEligibility}
        onCancel={handleCancelEligibility}
      />
    </form>
  );
}
