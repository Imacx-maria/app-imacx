"use client";

/**
 * IMACX Sortable Table Component
 *
 * Table with sortable columns following IMACX design system
 */

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

function isProbablyNumericString(raw: string): boolean {
  let s = raw.replace(/\u00A0/g, " ").trim(); // NBSP -> space
  if (!s) return false;

  // Strip common currency symbols placed at start/end.
  s = s.replace(/^[\s]*[€$£¥]\s*/g, "");
  s = s.replace(/\s*[€$£¥]\s*$/g, "");
  s = s.trim();

  if (!/\d/.test(s)) return false;
  // Allow digits, whitespace, sign, parentheses, separators, and percent.
  return /^[\s()+\-.,%0-9]+$/.test(s);
}

function shouldRightAlign(value: unknown): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") return isProbablyNumericString(value);
  return false;
}

export interface SortableColumnConfig {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  format?: (value: any) => string;
  sortable?: boolean;
}

interface ImacxSortableTableProps {
  columns: SortableColumnConfig[];
  data: any[];
  defaultSortColumn?: string;
  defaultSortDirection?: "asc" | "desc";
  className?: string;
}

export function ImacxSortableTable({
  columns,
  data,
  defaultSortColumn,
  defaultSortDirection = "asc",
  className,
}: ImacxSortableTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(
    defaultSortColumn || null,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSortDirection,
  );

  const handleSort = (columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    if (!column || column.sortable === false) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  return (
    <div className={cn("w-full overflow-auto", className)}>
      {/* eslint-disable-next-line imx/no-tailwind-border */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="imx-border-b bg-accent">
            {columns.map((column) => {
              const isSortable = column.sortable !== false;
              const isActive = sortColumn === column.key;

              return (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-sm font-normal uppercase text-accent-foreground",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    isSortable &&
                      "cursor-pointer select-none",
                  )}
                  onClick={() => isSortable && handleSort(column.key)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      column.align === "right" && "justify-end",
                      column.align === "center" && "justify-center",
                    )}
                  >
                    {column.header}
                    {isSortable && (
                      <span className="inline-block w-3 h-3 ml-1">
                        {isActive &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "imx-border-b transition-colors",
                "hover:bg-accent/50",
              )}
            >
              {columns.map((column) => {
                const value = row[column.key];
                const displayValue = column.format
                  ? column.format(value)
                  : value;

                return (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-sm",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      shouldRightAlign(displayValue) && "text-right tabular-nums",
                    )}
                  >
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
