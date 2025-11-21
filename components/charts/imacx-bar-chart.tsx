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

// IMACX Chart Colors - Colorful Palette (Default)
export const CHART_COLORS_COLORFUL = [
  "#ffa600", // Bright orange
  "#ff7c43", // Orange
  "#f95d6a", // Coral
  "#d45087", // Pink
  "#a05195", // Magenta
  "#665191", // Purple
  "#2f4b7c", // Blue
  "#003f5c", // Dark blue
];

// IMACX Chart Colors - Monochromatic Palette
export const CHART_COLORS_MONO = [
  "#ff9b19", // Orange 1
  "#ffa844", // Orange 2
  "#ffb564", // Orange 3
  "#ffc283", // Orange 4
  "#ffcfa1", // Orange 5
  "#fedcbf", // Orange 6
];

// Default color palette
export const CHART_COLORS = CHART_COLORS_COLORFUL;

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
  stacked?: boolean;
}

/**
 * IMACX Bar Chart
 *
 * @param data - Array of data objects
 * @param dataKey - Single key or array of keys for bars
 * @param xAxisKey - Key for x-axis labels (default: 'name')
 * @param height - Chart height in pixels (default: 400)
 * @param className - Additional CSS classes
 * @param stacked - Whether to stack bars (default: false)
 */
const ImacxBarChartInternal = ({
  data,
  dataKey,
  xAxisKey = "name",
  height = 400,
  className,
  stacked = false,
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
        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[0, 0, 0, 0]} // No rounded corners
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export const ImacxBarChart = memo(ImacxBarChartInternal);
