"use client";

/**
 * IMACX KPI Card Component
 *
 * Brutalist design KPI card following IMACX design system:
 * - Clean borders (no rounded corners)
 * - UPPERCASE labels
 * - Primary color for values
 * - Green/Red for positive/negative changes
 *
 * Memoized for performance: prevents re-renders when parent updates
 * unless props actually change
 */

import { memo } from "react";
import { cn } from "@/lib/utils";

interface ImacxKpiCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  className?: string;
}

/**
 * IMACX KPI Card
 *
 * @param label - KPI label (e.g., "Vendas YTD")
 * @param value - KPI value (can be number or formatted string)
 * @param change - Percentage change (optional, positive or negative)
 * @param changeLabel - Label for change (e.g., "vs 2024")
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <ImacxKpiCard
 *   label="Vendas YTD"
 *   value="€ 370.000"
 *   change={12.5}
 *   changeLabel="vs 2024"
 * />
 * ```
 */
const ImacxKpiCardComponent = ({
  label,
  value,
  change,
  changeLabel,
  className,
}: ImacxKpiCardProps) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={cn("imx-border bg-card p-6", className)}>
      <div className="uppercase text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-normal text-primary">
        {typeof value === "number" ? value.toLocaleString("pt-PT") : value}
      </div>
      {change !== undefined && (
        <div
          className={cn(
            "mt-2 text-sm uppercase",
            isPositive && "text-green-600",
            isNegative && "text-red-600",
          )}
        >
          {isPositive && "+"}
          {change.toFixed(1)}%{changeLabel && ` ${changeLabel}`}
        </div>
      )}
    </div>
  );
};

export const ImacxKpiCard = memo(ImacxKpiCardComponent);
