"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, X, Plus, Users, AlertTriangle, Check } from "lucide-react";
import { useVacationConflictRules } from "@/hooks/useFerias";
import type {
  VacationConflictRuleWithMembers,
  RHEmployeeWithDepartment,
  CreateConflictRuleInput,
  UpdateConflictRuleInput,
  CreateSubRuleInput,
} from "@/types/ferias";
import { cn } from "@/lib/utils";

interface ConflictRuleFormProps {
  rule?: VacationConflictRuleWithMembers | null;
  employees: RHEmployeeWithDepartment[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ConflictRuleForm({
  rule,
  employees,
  onSuccess,
  onCancel,
}: ConflictRuleFormProps) {
  const isEditing = !!rule;

  // Form state
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [maxAbsent, setMaxAbsent] = useState(rule?.max_absent || 1);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    rule?.members.map((m) => m.id) || [],
  );
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);

  // Sub-rule form state
  const [showSubRuleForm, setShowSubRuleForm] = useState(false);
  const [subRuleDescription, setSubRuleDescription] = useState("");
  const [subRuleMaxAbsent, setSubRuleMaxAbsent] = useState(1);
  const [subRuleEmployeeIds, setSubRuleEmployeeIds] = useState<string[]>([]);
  const [subRulePopoverOpen, setSubRulePopoverOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { createRule, updateRule, createSubRule } = useVacationConflictRules();

  // Get selected members info
  const selectedMembers = useMemo(() => {
    return employees.filter((e) => selectedMemberIds.includes(e.id));
  }, [employees, selectedMemberIds]);

  // Get available employees for sub-rules (only from selected members)
  const subRuleAvailableEmployees = useMemo(() => {
    return employees.filter((e) => selectedMemberIds.includes(e.id));
  }, [employees, selectedMemberIds]);

  const selectedSubRuleEmployees = useMemo(() => {
    return employees.filter((e) => subRuleEmployeeIds.includes(e.id));
  }, [employees, subRuleEmployeeIds]);

  // Handlers
  const toggleMember = (employeeId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
    // Also remove from sub-rule if removed from members
    if (selectedMemberIds.includes(employeeId)) {
      setSubRuleEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
    }
  };

  const toggleSubRuleMember = (employeeId: string) => {
    setSubRuleEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Nome e obrigatorio");
      return;
    }
    if (selectedMemberIds.length < 2) {
      setError("Selecione pelo menos 2 colaboradores");
      return;
    }
    if (maxAbsent < 1) {
      setError("Numero maximo de ausentes deve ser pelo menos 1");
      return;
    }
    if (maxAbsent >= selectedMemberIds.length) {
      setError(
        "Numero maximo de ausentes deve ser menor que o total de membros",
      );
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing && rule) {
        const updateData: UpdateConflictRuleInput = {
          id: rule.id,
          name: name.trim(),
          description: description.trim() || null,
          max_absent: maxAbsent,
          is_active: isActive,
          member_ids: selectedMemberIds,
        };
        await updateRule(updateData);
      } else {
        const createData: CreateConflictRuleInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          max_absent: maxAbsent,
          member_ids: selectedMemberIds,
        };
        await createRule(createData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Erro ao guardar regra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubRule = async () => {
    if (!rule) return;

    setError(null);

    // Validation
    if (subRuleEmployeeIds.length < 2) {
      setError("Sub-regra precisa de pelo menos 2 colaboradores");
      return;
    }
    if (subRuleMaxAbsent >= subRuleEmployeeIds.length) {
      setError("Max ausentes da sub-regra deve ser menor que o total");
      return;
    }

    setSubmitting(true);

    try {
      const input: CreateSubRuleInput = {
        rule_id: rule.id,
        employee_ids: subRuleEmployeeIds,
        max_absent: subRuleMaxAbsent,
        description: subRuleDescription.trim() || undefined,
      };
      await createSubRule(input);

      // Reset sub-rule form
      setShowSubRuleForm(false);
      setSubRuleDescription("");
      setSubRuleMaxAbsent(1);
      setSubRuleEmployeeIds([]);

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Erro ao criar sub-regra");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Regra *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Equipa Corte Noite"
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descricao</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descricao opcional da regra..."
            rows={2}
            disabled={submitting}
          />
        </div>
      </div>

      <Separator />

      {/* Members Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Membros do Grupo *</Label>
          <span className="text-xs text-muted-foreground">
            {selectedMemberIds.length} selecionados
          </span>
        </div>

        <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-start"
              disabled={submitting}
            >
              <Users className="mr-2 h-4 w-4" />
              {selectedMemberIds.length === 0
                ? "Selecionar colaboradores..."
                : `${selectedMemberIds.length} colaboradores selecionados`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Pesquisar colaborador..." />
              <CommandList>
                <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                <CommandGroup>
                  {employees.map((employee) => {
                    const isSelected = selectedMemberIds.includes(employee.id);
                    return (
                      <CommandItem
                        key={employee.id}
                        onSelect={() => toggleMember(employee.id)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm imx-border",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="font-mono text-xs mr-2">
                          {employee.sigla}
                        </span>
                        <span>{employee.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected members badges */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedMembers.map((member) => (
              <Badge
                key={member.id}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleMember(member.id)}
              >
                {member.sigla}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Max Absent */}
      <div className="space-y-2">
        <Label htmlFor="maxAbsent">Maximo de Ausentes Simultaneos *</Label>
        <div className="flex items-center gap-3">
          <Select
            value={String(maxAbsent)}
            onValueChange={(v) => setMaxAbsent(parseInt(v))}
            disabled={submitting}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: Math.max(1, selectedMemberIds.length - 1) },
                (_, i) => i + 1,
              ).map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            de {selectedMemberIds.length} membros
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Se mais de {maxAbsent} colaboradores tentarem estar ausentes ao mesmo
          tempo, sera mostrado um aviso.
        </p>
      </div>

      {/* Active toggle for editing */}
      {isEditing && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Regra Ativa</Label>
            <p className="text-xs text-muted-foreground">
              Regras inativas nao geram avisos
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={submitting}
          />
        </div>
      )}

      {/* Sub-rules section (only when editing) */}
      {isEditing && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Sub-regras</Label>
                <p className="text-xs text-muted-foreground">
                  Restricoes adicionais dentro do grupo
                </p>
              </div>
              {!showSubRuleForm && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubRuleForm(true)}
                  disabled={submitting || selectedMemberIds.length < 2}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar
                </Button>
              )}
            </div>

            {/* Sub-rule form */}
            {showSubRuleForm && (
              <div className="rounded-md imx-border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Nova Sub-regra
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Descricao</Label>
                  <Input
                    value={subRuleDescription}
                    onChange={(e) => setSubRuleDescription(e.target.value)}
                    placeholder="Ex: Nei e Varela (corte noite)"
                    disabled={submitting}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Colaboradores da Sub-regra</Label>
                  <Popover
                    open={subRulePopoverOpen}
                    onOpenChange={setSubRulePopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        disabled={submitting}
                      >
                        {subRuleEmployeeIds.length === 0
                          ? "Selecionar..."
                          : `${subRuleEmployeeIds.length} selecionados`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar..." />
                        <CommandList>
                          <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                          <CommandGroup>
                            {subRuleAvailableEmployees.map((employee) => {
                              const isSelected = subRuleEmployeeIds.includes(
                                employee.id,
                              );
                              return (
                                <CommandItem
                                  key={employee.id}
                                  onSelect={() =>
                                    toggleSubRuleMember(employee.id)
                                  }
                                >
                                  <div
                                    className={cn(
                                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm imx-border",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "opacity-50 [&_svg]:invisible",
                                    )}
                                  >
                                    <Check className="h-3 w-3" />
                                  </div>
                                  <span className="font-mono text-xs mr-2">
                                    {employee.sigla}
                                  </span>
                                  <span className="text-sm">
                                    {employee.name}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedSubRuleEmployees.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedSubRuleEmployees.map((emp) => (
                        <Badge
                          key={emp.id}
                          variant="outline"
                          className="text-xs cursor-pointer"
                          onClick={() => toggleSubRuleMember(emp.id)}
                        >
                          {emp.sigla}
                          <X className="ml-1 h-2 w-2" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">Max ausentes:</Label>
                  <Select
                    value={String(subRuleMaxAbsent)}
                    onValueChange={(v) => setSubRuleMaxAbsent(parseInt(v))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        {
                          length: Math.max(1, subRuleEmployeeIds.length - 1),
                        },
                        (_, i) => i + 1,
                      ).map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSubRule}
                    disabled={submitting || subRuleEmployeeIds.length < 2}
                  >
                    {submitting ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Guardar Sub-regra
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSubRuleForm(false);
                      setSubRuleDescription("");
                      setSubRuleMaxAbsent(1);
                      setSubRuleEmployeeIds([]);
                    }}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Existing sub-rules info */}
            {rule?.sub_rules && rule.sub_rules.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {rule.sub_rules.length} sub-regra(s) existente(s). Pode eliminar
                na tabela principal.
              </p>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Guardar Alteracoes" : "Criar Regra"}
        </Button>
      </div>
    </form>
  );
}
