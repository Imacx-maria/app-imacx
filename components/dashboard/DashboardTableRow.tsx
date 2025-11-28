"use client";

import React, { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import DatePicker from "@/components/ui/DatePicker";
import TransportePopover from "@/components/custom/TransportePopover";
import type { DashboardLogisticaRecord } from "@/components/DashboardLogisticaTable";
import type { ArmazemOption } from "@/components/forms/CreatableArmazemCombobox";

interface Transportadora {
  value: string;
  label: string;
}

export interface DashboardTableRowProps {
  record: DashboardLogisticaRecord;
  editValues: Record<string, any>;
  clienteLookup: Record<string, string>;
  armazens: ArmazemOption[];
  transportadoras: Transportadora[];
  updateEditValue: (recordId: string, field: string, value: unknown) => void;
  saveEditing: (record: DashboardLogisticaRecord) => void;
  handleRecolhaChange: (
    record: DashboardLogisticaRecord,
    value: string,
  ) => void;
  handleEntregaChange: (
    record: DashboardLogisticaRecord,
    value: string,
  ) => void;
  handleTransportadoraChange: (
    record: DashboardLogisticaRecord,
    value: string,
  ) => void;
  handleNotasSave: (record: DashboardLogisticaRecord, fields: any) => void;
  handleArmazensUpdate: () => Promise<void>;
  handleTransportadorasUpdate: () => Promise<void>;
  handleDataSaidaUpdate: (
    record: DashboardLogisticaRecord,
    date: Date | null,
  ) => void;
  handleConcluidoUpdate: (
    record: DashboardLogisticaRecord,
    value: boolean,
  ) => void;
  handleSaiuUpdate: (record: DashboardLogisticaRecord, value: boolean) => void;
  parseDateFromYYYYMMDD: (dateString: string) => Date;
  isMobile?: boolean;
}

const MAX_CLIENT_NAME_LENGTH = 28;

function DashboardTableRowInternal({
  record,
  editValues,
  clienteLookup,
  armazens,
  transportadoras,
  updateEditValue,
  saveEditing,
  handleRecolhaChange,
  handleEntregaChange,
  handleTransportadoraChange,
  handleNotasSave,
  handleArmazensUpdate,
  handleTransportadorasUpdate,
  handleDataSaidaUpdate,
  handleConcluidoUpdate,
  handleSaiuUpdate,
  parseDateFromYYYYMMDD,
  isMobile = false,
}: DashboardTableRowProps) {
  const recordId = `${record.item_id}-${record.logistica_id || "no-logistics"}`;
  const currentEditValues = editValues[recordId] || {};

  // Get truncated client name
  const clientId = record.id_cliente;
  const clientName =
    (clientId ? clienteLookup[clientId] : "") || record.cliente || "-";
  const displayClientName =
    clientName.length > MAX_CLIENT_NAME_LENGTH
      ? `${clientName.substring(0, MAX_CLIENT_NAME_LENGTH)}...`
      : clientName;

  return (
    <TableRow key={recordId} className="imx-row-hover">
      {/* FO - always visible */}
      <TableCell className="w-[70px]">{record.numero_fo || "-"}</TableCell>

      {/* ORC - always visible */}
      <TableCell className="w-[70px] text-center">
        {record.numero_orc || "-"}
      </TableCell>

      {/* Guia - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-[90px] text-center align-middle">
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
              if (values.guia !== undefined && values.guia !== record.guia) {
                saveEditing(record);
              }
            }}
            placeholder="-"
          />
        </TableCell>
      )}

      {/* Cliente - hidden on mobile */}
      {!isMobile && <TableCell>{displayClientName}</TableCell>}

      {/* Nome Campanha - hidden on mobile */}
      {!isMobile && <TableCell>{record.nome_campanha || "-"}</TableCell>}

      {/* Item - hidden on mobile */}
      {!isMobile && <TableCell>{record.item_descricao || "-"}</TableCell>}

      {/* Quantidade - always visible */}
      <TableCell className="w-[60px] text-center align-middle">
        {isMobile ? (
          <span>{record.logistica_quantidade || "-"}</span>
        ) : (
          <Input
            type="number"
            className="h-8 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={
              currentEditValues.quantidade ?? record.logistica_quantidade ?? ""
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
        )}
      </TableCell>

      {/* Transporte - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-[100px] text-center align-middle">
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
                await handleRecolhaChange(record, fields.id_local_recolha);
                await handleEntregaChange(record, fields.id_local_entrega);
                await handleTransportadoraChange(record, fields.transportadora);
                await handleNotasSave(record, {
                  outras: fields.notas,
                  peso: fields.peso,
                  nr_viaturas: fields.nr_viaturas,
                  nr_paletes: fields.nr_paletes,
                  data: record.data || null,
                });
              }}
              onArmazensUpdate={handleArmazensUpdate}
              onTransportadorasUpdate={handleTransportadorasUpdate}
            />
          </div>
        </TableCell>
      )}

      {/* Data Saída - always visible */}
      <TableCell className="w-[160px] text-center">
        {isMobile ? (
          <span className="text-sm">
            {record.data_saida
              ? parseDateFromYYYYMMDD(
                  record.data_saida.split("T")[0],
                ).toLocaleDateString("pt-PT", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : "-"}
          </span>
        ) : (
          <DatePicker
            value={
              record.data_saida
                ? parseDateFromYYYYMMDD(record.data_saida.split("T")[0])
                : undefined
            }
            onChange={(date) => handleDataSaidaUpdate(record, date || null)}
          />
        )}
      </TableCell>

      {/* Concluído - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-12 text-center">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={!!record.concluido}
              onCheckedChange={(checked) => {
                const value = checked === "indeterminate" ? false : checked;
                handleConcluidoUpdate(record, value);
              }}
            />
          </div>
        </TableCell>
      )}

      {/* Saiu - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-12 text-center">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={!!record.saiu}
              onCheckedChange={(checked) => {
                const value = checked === "indeterminate" ? false : checked;
                handleSaiuUpdate(record, value);
              }}
            />
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export const DashboardTableRow = memo(DashboardTableRowInternal);
