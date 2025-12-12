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
import { AlertTriangle } from "lucide-react";
import { formatDateDisplay } from "@/utils/ferias/vacationHelpers";

interface OverlappingSituation {
  id: string;
  start_date: string;
  end_date: string;
  situation_type_code: string;
  situation_type_name: string;
  business_days: number;
}

interface OverlapWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlappingSituations: OverlappingSituation[];
  employeeName: string;
  onReplace: () => void;
  onCancel: () => void;
}

export default function OverlapWarningDialog({
  open,
  onOpenChange,
  overlappingSituations,
  employeeName,
  onReplace,
  onCancel,
}: OverlapWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Datas Sobrepostas
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong>{employeeName}</strong> ja tem ausencia(s) registada(s) para as datas selecionadas:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {overlappingSituations.map((sit) => (
                  <div
                    key={sit.id}
                    className="p-2 rounded bg-muted text-sm"
                  >
                    <span className="font-medium">
                      {sit.situation_type_code} - {sit.situation_type_name}
                    </span>
                    <br />
                    <span className="text-muted-foreground">
                      {formatDateDisplay(sit.start_date)}
                      {sit.start_date !== sit.end_date && (
                        <> a {formatDateDisplay(sit.end_date)}</>
                      )}
                      {" "}({sit.business_days} dia{sit.business_days !== 1 ? "s" : ""})
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                O que pretende fazer?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onReplace}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            Substituir Existente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
