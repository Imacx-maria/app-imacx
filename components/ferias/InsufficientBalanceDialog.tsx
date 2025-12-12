"use client";

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
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Calendar, TrendingDown } from "lucide-react";
import { formatVacationBalance, formatDateDisplay } from "@/utils/ferias/vacationHelpers";

interface InsufficientBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  currentBalance: number;
  resultingBalance: number;
  onProceed: () => void;
  onCancel: () => void;
}

export default function InsufficientBalanceDialog({
  open,
  onOpenChange,
  employeeName,
  startDate,
  endDate,
  requestedDays,
  currentBalance,
  resultingBalance,
  onProceed,
  onCancel,
}: InsufficientBalanceDialogProps) {
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
            Saldo de Ferias Insuficiente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                <strong>{employeeName}</strong> nao tem dias de ferias suficientes
                para o periodo solicitado.
              </p>

              <div className="rounded-md imx-border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    Periodo: <strong>{dateRange}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Dias solicitados</div>
                    <div className="text-lg font-medium text-foreground">
                      {formatVacationBalance(requestedDays)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Saldo atual</div>
                    <div className="text-lg font-medium text-foreground">
                      {formatVacationBalance(currentBalance)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-muted-foreground">
                      Saldo resultante
                    </span>
                  </div>
                  <span className="text-lg font-bold text-destructive">
                    {formatVacationBalance(resultingBalance)}
                  </span>
                </div>
              </div>

              <Separator />

              <p className="text-sm">
                Pode prosseguir com o registo mesmo assim (o saldo ficara negativo),
                ou cancelar e escolher menos dias.
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
            Registar Mesmo Assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
