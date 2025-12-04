"use client";

import { memo } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown } from "lucide-react";

interface SortableTableHeaderProps<T extends string> {
  column: T;
  label: string;
  currentColumn: T;
  currentDirection: "asc" | "desc";
  onSort: (column: T) => void;
  className?: string;
  align?: "left" | "right" | "center";
}

function SortableTableHeaderComponent<T extends string>({
  column,
  label,
  currentColumn,
  currentDirection,
  onSort,
  className = "",
  align = "left",
}: SortableTableHeaderProps<T>) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "";

  const isActive = currentColumn === column;

  return (
    <TableHead
      className={`cursor-pointer select-none ${alignClass} ${className}`}
      onClick={() => onSort(column)}
    >
      {label}
      <span className="inline-block w-3 h-3 ml-1">
        {isActive &&
          (currentDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </span>
    </TableHead>
  );
}

export const SortableTableHeader = memo(
  SortableTableHeaderComponent
) as typeof SortableTableHeaderComponent;
