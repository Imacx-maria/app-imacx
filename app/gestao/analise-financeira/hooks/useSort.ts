import { useState } from "react";

export type SortDirection = "asc" | "desc";

export function useSort<T extends string>(
  initialColumn: T,
  initialDirection: SortDirection = "asc",
  defaultDirectionOnNewColumn: SortDirection = "asc"
) {
  const [sortColumn, setSortColumn] = useState<T>(initialColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const handleSort = (column: T) => {
    setSortDirection((prev) =>
      sortColumn === column
        ? prev === "asc"
          ? "desc"
          : "asc"
        : defaultDirectionOnNewColumn
    );
    setSortColumn(column);
  };

  return {
    sortColumn,
    sortDirection,
    handleSort,
    setSortColumn,
    setSortDirection,
  };
}
