"use client";

import { useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Calendar, Users } from "lucide-react";
import type { ConflictViolation } from "@/types/ferias";
import { formatDateDisplay } from "@/utils/ferias/vacationHelpers";

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  violations: ConflictViolation[];
  employeeName: string;
  startDate: string;
  endDate: string;
  onProceed: () => void;
  onCancel: () => void;
}

export default function ConflictWarningDialog({
  open,
  onOpenChange,
  violations,
  employeeName,
  startDate,
  endDate,
  onProceed,
  onCancel,
}: ConflictWarningDialogProps) {
  // Group violations by rule for cleaner display
  const groupedViolations = useMemo(() => {
    const groups: Record<
      string,
      {
        ruleName: string;
        ruleDescription?: string | null;
        maxAbsent: number;
        isSubRule: boolean;
        subRuleDescription?: string | null;
        dates: string[];
        absentEmployees: Set<string>;
      }
    > = {};

    violations.forEach((v) => {
      const key = v.is_sub_rule
        ? `${v.rule_id}-sub-${v.sub_rule_id}`
        : v.rule_id;

      if (!groups[key]) {
        groups[key] = {
          ruleName: v.rule_name,
          ruleDescription: v.rule_description,
          maxAbsent: v.max_absent,
          isSubRule: v.is_sub_rule,
          subRuleDescription: v.sub_rule_description,
          dates: [],
          absentEmployees: new Set(),
        };
      }

      groups[key].dates.push(v.date);
      v.absent_employees.forEach((emp) => {
        groups[key].absentEmployees.add(emp.sigla);
      });
    });

    return Object.values(groups);
  }, [violations]);

  // Format date range for display
  const dateRange =
    startDate === endDate
      ? formatDateDisplay(startDate)
      : `${formatDateDisplay(startDate)} a ${formatDateDisplay(endDate)}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Conflito de Ausencias Detetado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Ao agendar ausencia para <strong>{employeeName}</strong> de{" "}
                <strong>{dateRange}</strong>, foram detetados os seguintes
                conflitos:
              </p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {groupedViolations.map((group, idx) => (
                  <div
                    key={idx}
                    className="rounded-md imx-border bg-muted/50 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      {group.isSubRule ? (
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">
                          {group.isSubRule
                            ? group.subRuleDescription || "Sub-regra"
                            : group.ruleName}
                        </div>
                        {group.ruleDescription && !group.isSubRule && (
                          <div className="text-xs text-muted-foreground">
                            {group.ruleDescription}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        max {group.maxAbsent}
                      </Badge>
                    </div>

                    <div className="pl-6 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {group.dates.length === 1
                            ? formatDateDisplay(group.dates[0])
                            : `${group.dates.length} dias em conflito`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Ja ausentes:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(group.absentEmployees).map((sigla) => (
                            <Badge
                              key={sigla}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              {sigla}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <p className="text-sm">
                Pode prosseguir com o agendamento mesmo assim, ou cancelar e
                escolher outras datas.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onProceed}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            Agendar Mesmo Assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
