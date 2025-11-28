"use client";

import { cn } from "@/lib/utils";
import type {
  FullStatus,
  ItemStatus,
  LogisticsEntry,
} from "@/lib/status-hunter/types";
import { CheckCircle2, Clock, Package, Truck, User } from "lucide-react";

interface StatusDisplayProps {
  status: FullStatus;
  onNewSearch: () => void;
}

const TEXT = {
  designer: {
    noDesigner: "Sem designer atribuido",
    stage: "Estado atual",
  },
  logistics: {
    delivered: "Entregue",
    pending: "Pendente",
    guia: "Guia",
    carrier: "Transportadora",
    destination: "Destino",
    daysInProduction: "dias em producao",
  },
  quickActions: {
    newSearch: "Nova pesquisa",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function LogisticsCard({ entry }: { entry: LogisticsEntry }) {
  return (
    <div
      className={cn(
        "imx-border p-3",
        entry.delivered ? "bg-accent/50" : "bg-background",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {entry.delivered
              ? TEXT.logistics.delivered
              : TEXT.logistics.pending}
          </span>
        </div>
        {entry.guia && (
          <span className="text-xs text-muted-foreground">
            {TEXT.logistics.guia}: {entry.guia}
          </span>
        )}
      </div>

      {/* Details - stacked layout for mobile */}
      <div className="space-y-2 text-xs">
        {entry.transportadora && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {TEXT.logistics.carrier}:
            </span>
            <span className="text-right">{entry.transportadora}</span>
          </div>
        )}
        {entry.local_entrega && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {TEXT.logistics.destination}:
            </span>
            <span className="text-right">{entry.local_entrega}</span>
          </div>
        )}
        {entry.qty_delivered && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Qtd:</span>
            <span>{entry.qty_delivered}</span>
          </div>
        )}
        {entry.data_saida && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saida:</span>
            <span>{formatDate(entry.data_saida)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 imx-border-t text-xs text-muted-foreground">
        {entry.days_in_production} {TEXT.logistics.daysInProduction}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: ItemStatus }) {
  return (
    <div className="imx-border bg-card p-4 mb-3">
      {/* Item Header */}
      <div className="flex items-start justify-between mb-4 pb-3 imx-border-b">
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="font-medium text-sm leading-tight">
            {item.descricao}
          </h4>
          <span className="text-xs text-muted-foreground mt-1 block">
            Qtd: {item.quantidade}
          </span>
        </div>
        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {/* Designer Section */}
      <div className="mb-4 p-3 bg-accent/30">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {item.designer.name || TEXT.designer.noDesigner}
          </span>
        </div>
        <div className="text-xs mt-2">
          <span className="text-muted-foreground block mb-1">
            {TEXT.designer.stage}:
          </span>
          <span className="block">{item.designer.stage}</span>
        </div>
        {item.designer.paginacao && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>
              Paginado{" "}
              {item.designer.paginacao_date
                ? `em ${formatDate(item.designer.paginacao_date)}`
                : ""}
            </span>
          </div>
        )}
      </div>

      {/* Logistics Section */}
      {item.logistics.length > 0 && (
        <div>
          <h5 className="text-xs text-muted-foreground mb-2 uppercase">
            Logistica ({item.logistics.length})
          </h5>
          <div className="space-y-2">
            {item.logistics.map((entry) => (
              <LogisticsCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {item.logistics.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>Sem entregas registadas</span>
        </div>
      )}
    </div>
  );
}

export function StatusDisplay({ status, onNewSearch }: StatusDisplayProps) {
  return (
    <div className="space-y-4">
      {/* FO Header */}
      <div className="imx-border bg-primary/10 p-4">
        {/* FO Number and ORC */}
        <div className="flex items-center justify-between mb-4 pb-3 imx-border-b">
          <h3 className="text-lg font-medium">FO {status.fo.fo_number}</h3>
          {status.fo.orc_number && (
            <span className="text-xs text-muted-foreground">
              ORC: {status.fo.orc_number}
            </span>
          )}
        </div>

        {/* Details - stacked layout for readability */}
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs uppercase mb-1">
              Cliente
            </span>
            <span className="block">{status.fo.cliente || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs uppercase mb-1">
              Campanha
            </span>
            <span className="block">{status.fo.campanha || "-"}</span>
          </div>
          <div className="flex justify-between pt-2 imx-border-t">
            <div>
              <span className="text-muted-foreground text-xs">Criado:</span>
              <span className="ml-1 text-xs">
                {formatDate(status.fo.created_at)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Itens:</span>
              <span className="ml-1 text-xs">{status.items.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div>
        <h4 className="text-sm text-muted-foreground mb-3 uppercase">Itens</h4>
        {status.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {/* New Search Button */}
      <button
        onClick={onNewSearch}
        className="w-full imx-border bg-primary text-primary-foreground hover:bg-primary/90 py-3 px-4 text-sm font-medium uppercase"
      >
        {TEXT.quickActions.newSearch}
      </button>
    </div>
  );
}
