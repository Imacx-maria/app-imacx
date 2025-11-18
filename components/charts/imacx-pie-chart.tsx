'use client';

/**
 * IMACX Pie Chart Component
 *
 * Brutalist design pie/donut chart following IMACX design system:
 * - Flat design (no gradients)
 * - Clear segment separation
 * - OKLCH color palette
 * - External labels with values
 */

import { memo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { CustomTooltip, CHART_COLORS } from './imacx-bar-chart';

interface ImacxPieChartProps {
  data: any[];
  dataKey?: string;
  nameKey?: string;
  height?: number;
  innerRadius?: number;
  className?: string;
}

/**
 * IMACX Pie Chart
 *
 * @param data - Array of data objects
 * @param dataKey - Key for values (default: 'value')
 * @param nameKey - Key for labels (default: 'name')
 * @param height - Chart height in pixels (default: 400)
 * @param innerRadius - Inner radius for donut chart (0 = pie, 50 = donut)
 * @param className - Additional CSS classes
 */
const ImacxPieChartInternal = ({
  data,
  dataKey = 'value',
  nameKey = 'name',
  height = 400,
  innerRadius = 0,
  className
}: ImacxPieChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={innerRadius}
          label={({
            cx, cy, midAngle, innerRadius, outerRadius, value, index
          }) => {
            const RADIAN = Math.PI / 180;
            const radius = 25 + innerRadius + (outerRadius - innerRadius);
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);

            return (
              <text
                x={x}
                y={y}
                fill="var(--foreground)"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="uppercase text-xs"
                style={{ fontFamily: 'var(--font-atkinson)' }}
              >
                {`${data[index][nameKey]} (${value.toLocaleString('pt-PT')})`}
              </text>
            );
          }}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const ImacxPieChart = memo(ImacxPieChartInternal);
