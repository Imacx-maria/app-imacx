"use client";

/**
 * IMACX Line Chart Component
 *
 * Brutalist design line chart following IMACX design system:
 * - Straight lines (no curves)
 * - OKLCH color palette
 * - Atkinson Hyperlegible font
 * - UPPERCASE text
 */

import { memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CustomTooltip, CHART_COLORS } from "./imacx-bar-chart";

interface LineConfig {
  dataKey: string;
  name?: string;
  color?: string;
}

interface ImacxLineChartProps {
  data: any[];
  lines: LineConfig[];
  xAxisKey?: string;
  height?: number;
  className?: string;
}

/**
 * IMACX Line Chart
 *
 * @param data - Array of data objects
 * @param lines - Array of line configurations { dataKey, name?, color? }
 * @param xAxisKey - Key for x-axis labels (default: 'name')
 * @param height - Chart height in pixels (default: 400)
 * @param className - Additional CSS classes
 */
const ImacxLineChartInternal = ({
  data,
  lines,
  xAxisKey = "name",
  height = 400,
  className,
}: ImacxLineChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid
          strokeDasharray="0"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <XAxis
          dataKey={xAxisKey}
          tick={
            {
              fontSize: 12,
              fontFamily: "var(--font-atkinson)",
            } as any
          }
          angle={-45}
          textAnchor="end"
          stroke="var(--foreground)"
        />
        <YAxis
          tick={{
            fontSize: 12,
            fontFamily: "var(--font-atkinson)",
          }}
          tickFormatter={(value) => value.toLocaleString("pt-PT")}
          stroke="var(--foreground)"
        />
        <Tooltip content={<CustomTooltip />} />
        {lines.length > 1 && (
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{
              textTransform: "uppercase",
              fontFamily: "var(--font-atkinson)",
              fontSize: 12,
              paddingBottom: 10,
            }}
          />
        )}
        {lines.map((line, index) => (
          <Line
            key={line.dataKey}
            type="linear" // No curves, brutalist straight lines
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.color || CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 0 }} // Square markers would need custom implementation
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export const ImacxLineChart = memo(ImacxLineChartInternal);
