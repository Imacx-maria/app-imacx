"use client";

/**
 * IMACX Data Table Component
 *
 * Brutalist design table following IMACX design system:
 * - Clean borders (no rounded corners)
 * - UPPERCASE headers
 * - Atkinson Hyperlegible font
 * - Proper accessibility (44px min height)
 */

import { memo } from "react";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  format?: (value: any) => string;
}

interface ImacxTableProps {
  columns: ColumnConfig[];
  data: any[];
  className?: string;
}

/**
 * IMACX Data Table
 *
 * @param columns - Array of column configurations
 * @param data - Array of data objects
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const columns = [
 *   { key: 'id', header: 'ID' },
 *   { key: 'name', header: 'Nome' },
 *   { key: 'value', header: 'Valor', align: 'right', format: (v) => `${v} €` }
 * ];
 *
 * <ImacxTable columns={columns} data={tableData} />
 * ```
 */
const ImacxTableInternal = ({ columns, data, className }: ImacxTableProps) => {
  return (
    <div className={cn("w-full overflow-auto", className)}>
      {/* eslint-disable-next-line imx/no-tailwind-border */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="imx-border-b bg-accent">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-sm font-normal uppercase text-accent-foreground",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "imx-border-b transition-colors",
                "hover:bg-accent/50",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-sm",
                    column.align === "right" && "text-right tabular-nums",
                    column.align === "center" && "text-center",
                  )}
                >
                  {column.format
                    ? column.format(row[column.key])
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ImacxTable = memo(ImacxTableInternal);
