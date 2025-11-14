/**
 * Operation Progress Component
 * Shows visual progress for print/cut operations
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OperationProgressProps {
  planned: number;
  executed: number;
  remaining: number;
  progress: number;
  operationType?: "print" | "cut" | "cut-from-print";
  totalPrinted?: number; // For cut-from-print to show printed availability
  showDetails?: boolean;
  compact?: boolean;
}

export const OperationProgress: React.FC<OperationProgressProps> = ({
  planned,
  executed,
  remaining,
  progress,
  operationType = "print",
  totalPrinted,
  showDetails = true,
  compact = false,
}) => {
  // Determine status color
  const getStatusColor = () => {
    if (progress === 100) return "text-success";
    if (progress >= 50) return "text-info";
    if (progress > 0) return "text-warning";
    return "text-gray-500";
  };

  // Determine badge variant
  const getBadgeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (progress === 100) return "default";
    if (progress >= 50) return "secondary";
    return "outline";
  };

  // Get status icon
  const getStatusIcon = () => {
    if (progress === 100) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (progress > 0) return <Clock className="h-4 w-4 text-info" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  // Compact view - just the essentials
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {executed}/{planned}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-semibold">Progresso: {progress}%</div>
              <div>Planeado: {planned}</div>
              <div>Executado: {executed}</div>
              <div>Restante: {remaining}</div>
              {operationType === "cut-from-print" && totalPrinted !== undefined && (
                <div className="text-info">Impresso: {totalPrinted}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view with details
  return (
    <div className="space-y-2 p-3 imx-border rounded-md bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-semibold">
            {operationType === "print"
              ? "Progresso de Impressão"
              : operationType === "cut-from-print"
                ? "Progresso de Corte (de Impressões)"
                : "Progresso de Corte"}
          </span>
        </div>
        <Badge variant={getBadgeVariant()}>{progress}%</Badge>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Details */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Planeado</div>
            <div className="font-semibold">{planned}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Executado</div>
            <div className="font-semibold text-info">{executed}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Restante</div>
            <div className="font-semibold text-orange-600">{remaining}</div>
          </div>
        </div>
      )}

      {/* For cut-from-print, show printed availability */}
      {operationType === "cut-from-print" && totalPrinted !== undefined && (
        <div className="text-xs imx-border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Impresso Disponível:</span>
            <span className="font-semibold text-success">{totalPrinted}</span>
          </div>
          {totalPrinted < planned && (
            <div className="text-warning flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              <span>
                Aguardando impressão de {planned - totalPrinted} placas
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Simple inline progress indicator for table cells
 */
export const InlineProgress: React.FC<{
  current: number;
  total: number;
  type?: "print" | "cut";
}> = ({ current, total, type = "print" }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current >= total;
  const isPartial = current > 0 && current < total;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isComplete
                  ? "text-success"
                  : isPartial
                    ? "text-info"
                    : "text-gray-500"
              }`}
            >
              {current}/{total}
            </span>
            {isComplete && <CheckCircle2 className="h-3 w-3 text-success" />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div>
              {type === "print" ? "Impresso" : "Cortado"}: {current}
            </div>
            <div>Planeado: {total}</div>
            <div className="font-semibold">{percentage}% completo</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
