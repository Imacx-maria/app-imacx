"use client";

/**
 * IMACX Bar Chart Component
 *
 * Brutalist design bar chart following IMACX design system:
 * - No rounded corners
 * - OKLCH color palette
 * - Atkinson Hyperlegible font
 * - UPPERCASE text
 */

import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

// IMACX Chart Colors - matching design system OKLCH values
// These correspond to --chart-1 through --chart-12 in globals.css
export const CHART_COLORS = [
  "oklch(0.47 0.08 230)", // chart-1: Muted teal blue
  "oklch(0.65 0.1 140)", // chart-2: Earthy green
  "oklch(0.87 0.1 95)", // chart-3: Soft pastel yellow
  "oklch(0.77 0.02 75)", // chart-4: Warm beige
  "oklch(0.28 0.01 35)", // chart-5: Dark charcoal brown
  "oklch(0.62 0.1 235)", // chart-6: Sky blue
  "oklch(0.58 0.15 35)", // chart-7: Burnt orange
  "oklch(0.52 0.08 285)", // chart-8: Purple
  "oklch(0.68 0.12 155)", // chart-9: Light green
  "oklch(0.72 0.15 55)", // chart-10: Orange
  "oklch(0.62 0.18 25)", // chart-11: Red-orange
  "oklch(0.42 0.06 245)", // chart-12: Navy blue
];

// Custom Tooltip Component
export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background imx-border p-3 uppercase">
        <p className="text-sm font-normal">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString("pt-PT")}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface ImacxBarChartProps {
  data: any[];
  dataKey: string | string[];
  xAxisKey?: string;
  height?: number;
  className?: string;
}

/**
 * IMACX Bar Chart
 *
 * @param data - Array of data objects
 * @param dataKey - Single key or array of keys for bars
 * @param xAxisKey - Key for x-axis labels (default: 'name')
 * @param height - Chart height in pixels (default: 400)
 * @param className - Additional CSS classes
 */
const ImacxBarChartInternal = ({
  data,
  dataKey,
  xAxisKey = "name",
  height = 400,
  className,
}: ImacxBarChartProps) => {
  const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey];

  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid
          strokeDasharray="0"
          stroke="var(--border)"
          strokeWidth={1}
          vertical={false}
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
          height={100}
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
        {dataKeys.length > 1 && (
          <Legend
            wrapperStyle={{
              textTransform: "uppercase",
              fontFamily: "var(--font-atkinson)",
              fontSize: 12,
            }}
          />
        )}
        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[0, 0, 0, 0]} // No rounded corners
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export const ImacxBarChart = memo(ImacxBarChartInternal);
