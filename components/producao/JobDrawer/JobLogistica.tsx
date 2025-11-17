"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Copy, Plus, Loader2 } from "lucide-react";
import LogisticaTableWithCreatable from "@/components/custom/LogisticaTableWithCreatable";
import { Cliente } from "@/types/logistica";
import type { Job } from "./types";

export interface JobLogisticaProps {
  job: Job;
  supabase: any;
  logisticaRows: any[];
  logisticaLoading: boolean;
  logisticaClientes: Cliente[];
  extraClientes: Cliente[];
  logisticaTransportadoras: any[];
  logisticaArmazens: any[];
  sourceRowId: string | null;

  // Callbacks
  onRefreshLogistica: () => Promise<void>;
  onCopyDeliveryInfo: () => Promise<void>;
  onAddLogisticaRow: () => Promise<void>;
  onSourceRowChange: (rowId: string | null) => void;
  onFoSave: (row: any, foValue: string) => Promise<void>;
  onClienteChange: (row: any, value: string) => Promise<void>;
  onItemSave: (row: any, value: string) => Promise<void>;
  onConcluidoSave: (row: any, value: boolean) => Promise<void>;
  onDataConcluidoSave: (row: any, value: string) => Promise<void>;
  onSaiuSave: (row: any, value: boolean) => Promise<void>;
  onGuiaSave: (row: any, value: string) => Promise<void>;
  onBrindesSave: (row: any, value: boolean) => Promise<void>;
  onRecolhaChange: (rowId: string, value: string) => Promise<void>;
  onEntregaChange: (rowId: string, value: string) => Promise<void>;
  onTransportadoraChange: (row: any, value: string) => Promise<void>;
  onQuantidadeSave: (row: any, value: number | null) => Promise<void>;
  onDuplicateRow: (row: any) => Promise<void>;
  onNotasSave: (
    row: any,
    outras: string,
    contacto?: string,
    telefone?: string,
    contacto_entrega?: string,
    telefone_entrega?: string,
    data?: string | null
  ) => Promise<void>;
  onDeleteRow: (rowId: string) => Promise<void>;
  onArmazensUpdate: () => void;
  onTransportadorasUpdate: () => void;
  onClientesUpdate: () => void;
  setLogisticaRows: React.Dispatch<React.SetStateAction<any[]>>;
  setExtraClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
}

/**
 * JobLogistica Component
 * Handles the "Logística" tab - displays and manages logistics/delivery information
 */
function JobLogisticaComponent({
  job,
  supabase,
  logisticaRows,
  logisticaLoading,
  logisticaClientes,
  extraClientes,
  logisticaTransportadoras,
  logisticaArmazens,
  sourceRowId,
  onRefreshLogistica,
  onCopyDeliveryInfo,
  onAddLogisticaRow,
  onSourceRowChange,
  onFoSave,
  onClienteChange,
  onItemSave,
  onConcluidoSave,
  onDataConcluidoSave,
  onSaiuSave,
  onGuiaSave,
  onBrindesSave,
  onRecolhaChange,
  onEntregaChange,
  onTransportadoraChange,
  onQuantidadeSave,
  onDuplicateRow,
  onNotasSave,
  onDeleteRow,
  onArmazensUpdate,
  onTransportadorasUpdate,
  onClientesUpdate,
  setLogisticaRows,
  setExtraClientes,
}: JobLogisticaProps) {
  return (
    <div className="mt-6">
      <div className="mb-6 flex items-start justify-between">
        <div className="p-0">
          <h2 className="text-xl">Listagem Recolhas Entregas</h2>
          <p className="text-muted-foreground text-sm">
            Listagem de recolhas e entregas para esta folha de obra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh logistics data button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshLogistica}
            disabled={logisticaLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${logisticaLoading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button size="sm" variant="default" onClick={onCopyDeliveryInfo}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar Entrega
            {sourceRowId && (
              <span className="bg-primary/20 ml-2 rounded px-2 py-1 text-xs">
                Fonte:{" "}
                {logisticaRows.find((r) => r.id === sourceRowId)?.items_base
                  ?.descricao || "Selecionada"}
              </span>
            )}
          </Button>
          {/* Add new logistics row */}
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddLogisticaRow}
            className="ml-2"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Linha
          </Button>
        </div>
      </div>
      {logisticaLoading ? (
        <div className="mt-6 flex h-40 items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : (
        <LogisticaTableWithCreatable
          records={logisticaRows}
          clientes={[...logisticaClientes, ...extraClientes]}
          transportadoras={logisticaTransportadoras}
          armazens={logisticaArmazens}
          hideColumns={["saiu", "cliente", "guia"]}
          hideActions={false}
          showSourceSelection={true}
          sourceRowId={sourceRowId}
          onSourceRowChange={onSourceRowChange}
          onFoSave={onFoSave}
          onClienteChange={onClienteChange}
          onItemSave={onItemSave}
          onConcluidoSave={onConcluidoSave}
          onDataConcluidoSave={onDataConcluidoSave}
          onSaiuSave={onSaiuSave}
          onGuiaSave={onGuiaSave}
          onBrindesSave={onBrindesSave}
          onRecolhaChange={onRecolhaChange}
          onEntregaChange={onEntregaChange}
          onTransportadoraChange={onTransportadoraChange}
          onQuantidadeSave={onQuantidadeSave}
          onDuplicateRow={onDuplicateRow}
          onNotasSave={onNotasSave}
          onDeleteRow={onDeleteRow}
          tableDate={new Date().toISOString().split("T")[0]}
          onArmazensUpdate={onArmazensUpdate}
          onTransportadorasUpdate={onTransportadorasUpdate}
          onClientesUpdate={onClientesUpdate}
        />
      )}
    </div>
  );
}

export const JobLogistica = memo(JobLogisticaComponent);
