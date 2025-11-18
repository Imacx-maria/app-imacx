"use client";

import { memo, CSSProperties } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import DatePicker from "@/components/ui/DatePicker";
import TransportePopover from "@/components/custom/TransportePopover";
import { DashboardLogisticaRecord } from "@/components/DashboardLogisticaTable";
import { ArmazemOption } from "@/components/forms/CreatableArmazemCombobox";
import { TransportadoraOption } from "@/components/forms/CreatableTransportadoraCombobox";

interface VirtualizedEmCursoRowProps {
  record: DashboardLogisticaRecord;
  style: CSSProperties;
  recordId: string;
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

const VirtualizedEmCursoRowComponent = ({
  record,
  style,
  recordId,
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
  parseDateFromYYYYMMDD: parseDateFromYYYYMMDD,
}: VirtualizedEmCursoRowProps) => {
  const currentEditValues = editValues[recordId] || {};

  return (
    <div style={style} className="flex w-full">
      <TableRow className="imx-row-hover w-full">
        {/* FO - Not editable */}
        <TableCell>{record.numero_fo || "-"}</TableCell>

        {/* ORC - Not editable */}
        <TableCell className="text-center">
          {record.numero_orc || "-"}
        </TableCell>

        {/* Guia - Always Editable */}
        <TableCell className="text-center align-middle">
          <Input
            className="h-8 text-sm text-center"
            maxLength={5}
            value={currentEditValues.guia ?? record.guia ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 5) {
                updateEditValue(recordId, "guia", value);
              }
            }}
            onBlur={() => {
              const values = editValues[recordId] || {};
              if (
                values.guia !== undefined &&
                values.guia !== record.guia
              ) {
                saveEditing(record);
              }
            }}
            placeholder="-"
          />
        </TableCell>

        {/* Cliente - Not editable */}
        <TableCell>
          {(() => {
            const clientId = record.id_cliente;
            const clientName =
              (clientId ? clienteLookup[clientId] : "") ||
              record.cliente ||
              "-";

            // Truncate at 28 characters and add "..." if longer
            return clientName.length > 28
              ? `${clientName.substring(0, 28)}...`
              : clientName;
          })()}
        </TableCell>

        {/* Nome Campanha - Not editable */}
        <TableCell>{record.nome_campanha || "-"}</TableCell>

        {/* Item - Not editable */}
        <TableCell>{record.item_descricao || "-"}</TableCell>

        {/* Quantidade - Always Editable */}
        <TableCell className="text-center align-middle">
          <Input
            type="number"
            className="h-8 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={
              currentEditValues.quantidade ??
              record.logistica_quantidade ??
              ""
            }
            onChange={(e) =>
              updateEditValue(
                recordId,
                "quantidade",
                Number(e.target.value) || null,
              )
            }
            onBlur={() => {
              const values = editValues[recordId] || {};
              if (
                values.quantidade !== undefined &&
                values.quantidade !== record.logistica_quantidade
              ) {
                saveEditing(record);
              }
            }}
            placeholder="-"
          />
        </TableCell>

        {/* Transporte - Popover with Local Recolha, Local Entrega, Transportadora, Notas, etc */}
        <TableCell className="text-center align-middle">
          <div className="flex items-center justify-center">
            <TransportePopover
              localRecolha={record.local_recolha || ""}
              localEntrega={record.local_entrega || ""}
              transportadora={record.transportadora || ""}
              idLocalRecolha={record.id_local_recolha || ""}
              idLocalEntrega={record.id_local_entrega || ""}
              notas={record.notas || ""}
              peso={record.peso || ""}
              nrViaturas={record.nr_viaturas || ""}
              nrPaletes={record.nr_paletes || ""}
              armazens={armazens}
              transportadoras={transportadoras}
              onSave={async (fields) => {
                await handleRecolhaChange(
                  record,
                  fields.id_local_recolha,
                );
                await handleEntregaChange(
                  record,
                  fields.id_local_entrega,
                );
                await handleTransportadoraChange(
                  record,
                  fields.transportadora,
                );
                await handleNotasSave(record, {
                  outras: fields.notas,
                  peso: fields.peso,
                  nr_viaturas: fields.nr_viaturas,
                  nr_paletes: fields.nr_paletes,
                  data: record.data || null,
                });
              }}
              onArmazensUpdate={handleArmazensUpdate}
              onTransportadorasUpdate={
                handleTransportadorasUpdate
              }
            />
          </div>
        </TableCell>

        {/* Data Saída - DatePicker (always interactive) */}
        <TableCell>
          <DatePicker
            value={
              record.data_saida
                ? parseDateFromYYYYMMDD(
                    record.data_saida.split("T")[0],
                  )
                : undefined
            }
            onChange={(date) =>
              handleDataSaidaUpdate(record, date || null)
            }
          />
        </TableCell>

        {/* Concluído - Checkbox (always interactive) */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={!!record.concluido}
              onCheckedChange={(checked) => {
                const value =
                  checked === "indeterminate" ? false : checked;
                handleConcluidoUpdate(record, value);
              }}
            />
          </div>
        </TableCell>

        {/* Saiu - Always interactive */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={!!record.saiu}
              onCheckedChange={(checked) => {
                const value =
                  checked === "indeterminate" ? false : checked;
                handleSaiuUpdate(record, value);
              }}
            />
          </div>
        </TableCell>
      </TableRow>
    </div>
  );
};

/**
 * Memoized virtualized row component for DashboardLogisticaTable.
 * Prevents unnecessary re-renders when props haven't changed.
 * Used with react-window's FixedSizeList for performance.
 */
export const VirtualizedEmCursoRow = memo(VirtualizedEmCursoRowComponent);
