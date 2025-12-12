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
import { AlertTriangle, Calendar } from "lucide-react";
import { formatDateDisplay } from "@/utils/ferias/vacationHelpers";

interface EligibilityWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  admissionDate: string;
  eligibilityDate: Date;
  onProceed: () => void;
  onCancel: () => void;
}

export default function EligibilityWarningDialog({
  open,
  onOpenChange,
  employeeName,
  admissionDate,
  eligibilityDate,
  onProceed,
  onCancel,
}: EligibilityWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Periodo de Elegibilidade
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                De acordo com a lei portuguesa, ferias so podem ser gozadas apos
                6 meses de trabalho.
              </p>

              <div className="rounded-md imx-border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    Colaborador: <strong>{employeeName}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Data de Admissao</div>
                    <div className="font-medium text-foreground">
                      {formatDateDisplay(admissionDate)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Elegivel a partir de</div>
                    <div className="font-medium text-foreground">
                      {formatDateDisplay(eligibilityDate.toISOString().split("T")[0])}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <p className="text-sm">
                Pode prosseguir com o registo mesmo assim, ou cancelar e escolher
                datas apos o periodo de elegibilidade.
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
