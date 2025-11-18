"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { VirtualizedEmCursoRow } from "./VirtualizedEmCursoRow";
import { DashboardLogisticaRecord } from "@/components/DashboardLogisticaTable";
import { ArmazemOption } from "@/components/forms/CreatableArmazemCombobox";
import { TransportadoraOption } from "@/components/forms/CreatableTransportadoraCombobox";
import { useRef, useMemo } from "react";

interface VirtualizedTableBodyEmCursoProps {
  records: DashboardLogisticaRecord[];
  editValues: Record<string, any>;

  // Callbacks
  updateEditValue: (recordId: string, field: string, value: any) => void;
  saveEditing: (record: DashboardLogisticaRecord) => void;

  // Handlers for popover and date picker
  handleRecolhaChange: (record: DashboardLogisticaRecord, value: string) => Promise<void>;
  handleEntregaChange: (record: DashboardLogisticaRecord, value: string) => Promise<void>;
  handleTransportadoraChange: (record: DashboardLogisticaRecord, value: string) => Promise<void>;
  handleNotasSave: (record: DashboardLogisticaRecord, fields: any) => Promise<void>;
  handleDataSaidaUpdate: (record: DashboardLogisticaRecord, date: Date | null) => Promise<void>;
  handleConcluidoUpdate: (record: DashboardLogisticaRecord, value: boolean) => Promise<void>;
  handleSaiuUpdate: (record: DashboardLogisticaRecord, value: boolean) => Promise<void>;
  handleArmazensUpdate: () => Promise<void>;
  handleTransportadorasUpdate: () => Promise<void>;

  // Data
  armazens: ArmazemOption[];
  transportadoras: TransportadoraOption[];
  clienteLookup: Record<string, string>;
  parseDateFromYYYYMMDD: (dateStr: string) => Date | undefined;
}

/**
 * Virtualized table body component using react-window's FixedSizeList.
 * Only renders visible rows in the DOM (80-90% reduction in DOM nodes).
 * Maintains edit state for all rows, even those outside viewport.
 */
export const VirtualizedTableBodyEmCurso = ({
  records,
  editValues,
  updateEditValue,
  saveEditing,
  handleRecolhaChange,
  handleEntregaChange,
  handleTransportadoraChange,
  handleNotasSave,
  handleDataSaidaUpdate,
  handleConcluidoUpdate,
  handleSaiuUpdate,
  handleArmazensUpdate,
  handleTransportadorasUpdate,
  armazens,
  transportadoras,
  clienteLookup,
  parseDateFromYYYYMMDD,
}: VirtualizedTableBodyEmCursoProps) => {
  const ROW_HEIGHT = 48; // Height in pixels per row
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Render 10 items outside viewport for smoother scrolling
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: "800px", width: "100%" }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const record = records[virtualItem.index];
          const recordId = `${record.item_id}-${record.logistica_id || "no-logistics"}`;

          return (
            <div
              key={recordId}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <VirtualizedEmCursoRow
                record={record}
                recordId={recordId}
                style={{ height: `${virtualItem.size}px`, width: "100%" }}
                editValues={editValues}
                updateEditValue={updateEditValue}
                saveEditing={saveEditing}
                handleRecolhaChange={handleRecolhaChange}
                handleEntregaChange={handleEntregaChange}
                handleTransportadoraChange={handleTransportadoraChange}
                handleNotasSave={handleNotasSave}
                handleDataSaidaUpdate={handleDataSaidaUpdate}
                handleConcluidoUpdate={handleConcluidoUpdate}
                handleSaiuUpdate={handleSaiuUpdate}
                handleArmazensUpdate={handleArmazensUpdate}
                handleTransportadorasUpdate={handleTransportadorasUpdate}
                armazens={armazens}
                transportadoras={transportadoras}
                clienteLookup={clienteLookup}
                parseDateFromYYYYMMDD={parseDateFromYYYYMMDD}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
