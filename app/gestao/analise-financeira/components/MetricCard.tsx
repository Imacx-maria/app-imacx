import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number;
  previousValue: number;
  change: number;
  formatter?: (value: number) => string;
  subtitle?: string;
}

export const MetricCard = ({
  title,
  value,
  previousValue,
  change,
  formatter = (v) => v.toLocaleString(),
  subtitle = "VS. PERÍODO ANTERIOR",
}: MetricCardProps) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const changeAbs = Math.abs(change);

  return (
    <Card className="p-5">
      <div className="flex h-full flex-col">
        {/* Title - uppercase, muted */}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

        {/* Main Value - HUGE */}
        <p className="metric-value mt-3 font-light tracking-tight">
          {formatter(value)}
        </p>

        {/* Spacer to push bottom content down */}
        <div className="flex-1 min-h-4" />

        {/* Trend indicator row - colored arrows and percentages */}
        <div className="mt-4 flex items-center gap-2">
          {isPositive ? (
            <ArrowUpRight className="h-5 w-5 text-green-500" />
          ) : isNegative ? (
            <ArrowDownRight className="h-5 w-5 text-red-500" />
          ) : (
            <Minus className="h-5 w-5 text-muted-foreground" />
          )}
          <span
            className={`text-sm font-medium ${
              isPositive
                ? "text-green-500"
                : isNegative
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {subtitle}
          </span>
        </div>

        {/* Previous period row */}
        <div className="mt-3 flex items-baseline justify-between imx-border-t pt-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Ano anterior:
          </span>
          <span className="text-sm font-medium">
            {formatter(previousValue)}
          </span>
        </div>
      </div>
    </Card>
  );
};
