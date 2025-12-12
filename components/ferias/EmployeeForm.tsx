"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  useRHEmployees,
  useDepartamentos,
  useVacationPolicyDefaults,
} from "@/hooks/useFerias";
import DatePicker from "@/components/ui/DatePicker";
import type {
  RHEmployeeWithDepartment,
  CreateRHEmployeeInput,
  UpdateRHEmployeeInput,
} from "@/types/ferias";

interface EmployeeFormProps {
  employee?: RHEmployeeWithDepartment | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({
  employee,
  onSuccess,
  onCancel,
}: EmployeeFormProps) {
  const isEditing = !!employee;

  // Form state
  const [name, setName] = useState(employee?.name || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [departamentoId, setDepartamentoId] = useState<string>(
    employee?.departamento_id ? String(employee.departamento_id) : "",
  );
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>(
    employee?.admission_date ? new Date(employee.admission_date) : undefined,
  );
  const [contractType, setContractType] = useState<"contract" | "freelancer">(
    employee?.contract_type || "contract",
  );
  const [isActive, setIsActive] = useState(employee?.is_active ?? true);
  const [annualVacationDays, setAnnualVacationDays] = useState<number>(
    employee?.annual_vacation_days || 22,
  );
  const [previousYearBalance, setPreviousYearBalance] = useState<number>(
    employee?.previous_year_balance || 0,
  );
  const [currentYearTotal, setCurrentYearTotal] = useState<number>(
    employee?.current_year_total || 0,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { createEmployee, updateEmployee } = useRHEmployees();
  const { departamentos } = useDepartamentos();
  const { policy: vacationPolicy } = useVacationPolicyDefaults();

  // Update annual days when contract type or policy changes (only for new employees)
  useEffect(() => {
    if (!isEditing) {
      setAnnualVacationDays(
        contractType === "contract"
          ? vacationPolicy.contract_default_days
          : vacationPolicy.freelancer_default_days,
      );
    }
  }, [contractType, isEditing, vacationPolicy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Nome e obrigatorio");
      return;
    }
    if (!admissionDate) {
      setError("Data de admissao e obrigatoria");
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing && employee) {
        const updateData: UpdateRHEmployeeInput = {
          id: employee.id,
          name: name.trim(),
          email: email.trim() || undefined,
          departamento_id: departamentoId
            ? parseInt(departamentoId)
            : undefined,
          admission_date: admissionDate.toISOString().split("T")[0],
          contract_type: contractType,
          is_active: isActive,
          annual_vacation_days: annualVacationDays,
          previous_year_balance: previousYearBalance,
          current_year_total: currentYearTotal,
        };
        await updateEmployee(updateData);
      } else {
        const createData: CreateRHEmployeeInput = {
          name: name.trim(),
          email: email.trim() || undefined,
          departamento_id: departamentoId
            ? parseInt(departamentoId)
            : undefined,
          admission_date: admissionDate.toISOString().split("T")[0],
          contract_type: contractType,
          annual_vacation_days: annualVacationDays,
        };
        await createEmployee(createData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Erro ao guardar colaborador");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome completo"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplo.com"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="departamento">Departamento</Label>
        <Select
          value={departamentoId || "none"}
          onValueChange={(value) =>
            setDepartamentoId(value === "none" ? "" : value)
          }
          disabled={submitting}
        >
          <SelectTrigger id="departamento">
            <SelectValue placeholder="Selecionar departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {departamentos.map((dept) => (
              <SelectItem key={dept.id} value={String(dept.id)}>
                {dept.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Data de Admissao *</Label>
        <DatePicker value={admissionDate} onChange={setAdmissionDate} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contractType">Tipo de Contrato *</Label>
        <Select
          value={contractType}
          onValueChange={(value) =>
            setContractType(value as "contract" | "freelancer")
          }
          disabled={submitting}
        >
          <SelectTrigger id="contractType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contract">
              Contrato ({vacationPolicy.contract_default_days} dias)
            </SelectItem>
            <SelectItem value="freelancer">
              Freelancer ({vacationPolicy.freelancer_default_days} dias)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="annualDays">Dias Anuais de Ferias</Label>
        <Input
          id="annualDays"
          type="number"
          min={0}
          max={30}
          value={annualVacationDays}
          onChange={(e) => setAnnualVacationDays(parseInt(e.target.value) || 0)}
          disabled={submitting}
        />
      </div>

      {isEditing && (
        <>
          <div className="space-y-2">
            <Label htmlFor="previousBalance">Saldo Ano Anterior</Label>
            <Input
              id="previousBalance"
              type="number"
              step="0.5"
              min={0}
              max={20}
              value={previousYearBalance}
              onChange={(e) =>
                setPreviousYearBalance(parseFloat(e.target.value) || 0)
              }
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentTotal">Total Ano Atual</Label>
            <Input
              id="currentTotal"
              type="number"
              step="0.5"
              min={0}
              value={currentYearTotal}
              onChange={(e) =>
                setCurrentYearTotal(parseFloat(e.target.value) || 0)
              }
              disabled={submitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4"
            />
            <Label htmlFor="isActive">Colaborador Ativo</Label>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar...
            </>
          ) : isEditing ? (
            "Guardar"
          ) : (
            "Criar"
          )}
        </Button>
      </div>
    </form>
  );
}
