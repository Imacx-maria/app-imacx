import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DuplicateDialogState } from "@/types/producao";

interface DuplicateWarningDialogProps {
  dialogState: DuplicateDialogState;
  onClose: () => void;
}

/**
 * Dialog component for warning about duplicate ORC/FO numbers
 * Memoized to prevent unnecessary re-renders
 */
export const DuplicateWarningDialog = memo(function DuplicateWarningDialog({
  dialogState,
  onClose,
}: DuplicateWarningDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (dialogState.onCancel) {
        dialogState.onCancel();
      } else {
        onClose();
      }
    }
  };

  return (
    <Dialog open={dialogState.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialogState.type === "orc" ? "ORC Duplicado" : "FO Duplicada"}
          </DialogTitle>
          <DialogDescription>
            {dialogState.type === "orc"
              ? `O número de ORC "${dialogState.value}" já existe numa folha de obra.`
              : `O número de FO "${dialogState.value}" já existe.`}
          </DialogDescription>
        </DialogHeader>

        {dialogState.existingJob && (
          <div className="my-4 rounded-md imx-border bg-accent/10 p-4">
            <h4 className="mb-2 font-semibold text-warning">
              Trabalho Existente:
            </h4>
            <div className="space-y-1 text-sm text-warning-foreground">
              <div>
                <strong>FO:</strong> {dialogState.existingJob.numero_fo}
              </div>
              <div>
                <strong>ORC:</strong>{" "}
                {dialogState.existingJob.numero_orc || "N/A"}
              </div>
              <div>
                <strong>Campanha:</strong>{" "}
                {dialogState.existingJob.nome_campanha}
              </div>
              <div>
                <strong>Cliente:</strong>{" "}
                {dialogState.existingJob.cliente || "N/A"}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={dialogState.onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={dialogState.onConfirm}>
            Continuar Mesmo Assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
