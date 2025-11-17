"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { X, RefreshCw, Loader2 } from "lucide-react";
import type { Job } from "./types";

interface TopActionsProps {
  job: Job | null;
  onClose: () => void;
  onRefreshValor?: () => void;
  refreshingValor?: boolean;
}

/**
 * TopActions Component
 * Displays action buttons at the top of the drawer (PHC refresh, close)
 */
function TopActionsComponent({
  job,
  onClose,
  onRefreshValor,
  refreshingValor = false,
}: TopActionsProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>{/* Left side can hold title/info if needed */}</div>
      <div className="flex gap-2">
        {onRefreshValor && job && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshValor}
            disabled={refreshingValor}
          >
            {refreshingValor ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Valor PHC
              </>
            )}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export const TopActions = memo(TopActionsComponent);
