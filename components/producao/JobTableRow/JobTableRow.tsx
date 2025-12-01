"use client";

import React, { memo } from "react";
import dynamic from "next/dynamic";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import { ViewButton } from "@/components/custom/ActionButtons";
import { formatDatePortuguese } from "@/utils/producao/dateHelpers";
import {
  getPColor,
  getAColor,
  getCColor,
} from "@/utils/producao/statusColors";
import type { JobTableRowProps } from "./types";
import type { Job, ClienteOption } from "@/types/producao";

// Lazy load heavy components
const CreatableClienteCombobox = dynamic(
  () => import("@/components/forms/CreatableClienteCombobox"),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
    ),
  }
);
const SimpleNotasPopover = dynamic(
  () => import("@/components/custom/SimpleNotasPopover"),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
    ),
  }
);

function JobTableRowInternal({
  job,
  variant,
  completionPercentage,
  jobTotalValue,
  clientes,
  loading,
  jobItems,
  designerItems,
  operacoes,
  isMobile = false,
  onOrcChange,
  onOrcBlur,
  onFoChange,
  onFoBlur,
  onClienteChange,
  onClientesUpdate,
  onCampanhaChange,
  onCampanhaBlur,
  onNotasSave,
  onPrioridadeClick,
  onPendenteChange,
  onViewClick,
  onDeleteClick,
  onItemsConcluidoChange,
}: JobTableRowProps) {
  const pct = completionPercentage;
  const isEmCurso = variant === "em_curso";

  // Calculate items completed status for concluidos variant
  const allItemsCompleted =
    jobItems.length > 0 && jobItems.every((item) => item.concluido === true);

  return (
    <TableRow key={job.id} className="imx-row-hover">
      {/* Data */}
      <TableCell className="w-[90px] text-center text-xs">
        {formatDatePortuguese(job.data_in)}
      </TableCell>

      {/* ORC Input */}
      <TableCell className="w-[90px] max-w-[90px]">
        <Input
          type="text"
          maxLength={6}
          value={job.numero_orc ?? ""}
          onChange={(e) => {
            const value = e.target.value === "" ? null : e.target.value;
            onOrcChange(job.id, value);
          }}
          onBlur={(e) => onOrcBlur(job, e.target.value.trim())}
          className="h-10 text-right text-sm"
          placeholder="ORC"
        />
      </TableCell>

      {/* FO Input */}
      <TableCell className="w-[90px] max-w-[90px]">
        <Input
          maxLength={6}
          value={job.numero_fo}
          onChange={(e) => onFoChange(job.id, e.target.value)}
          onBlur={(e) => onFoBlur(job, e.target.value.trim())}
          className="h-10 text-right text-sm"
          placeholder="FO"
        />
      </TableCell>

      {/* Cliente Combobox - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-[200px]">
          <CreatableClienteCombobox
            value={job.id_cliente || ""}
            onChange={(selectedId: string) => onClienteChange(job, selectedId)}
            options={clientes}
            onOptionsUpdate={(newClientes: ClienteOption[]) =>
              onClientesUpdate(newClientes)
            }
            placeholder="Cliente"
            disabled={loading.clientes}
            loading={loading.clientes}
            displayLabel={job.cliente || undefined}
          />
        </TableCell>
      )}

      {/* Campanha Input */}
      <TableCell className="flex-1">
        <Input
          value={job.nome_campanha}
          onChange={(e) => onCampanhaChange(job.id, e.target.value)}
          onBlur={(e) => onCampanhaBlur(job, e.target.value)}
          className="h-10 w-full text-sm"
          placeholder="Nome da Campanha"
        />
      </TableCell>

      {/* Notas Popover - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-[50px] text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SimpleNotasPopover
                    value={job.notas ?? ""}
                    onSave={(newNotas) => onNotasSave(job, newNotas)}
                    placeholder="Adicionar notas..."
                    label="Notas"
                    buttonSize="icon"
                    className="mx-auto aspect-square"
                    disabled={false}
                  />
                </div>
              </TooltipTrigger>
              {job.notas && job.notas.trim() !== "" && (
                <TooltipContent>{job.notas}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      )}

      {/* Progress Bar - hidden on mobile */}
      {!isMobile && (
        <TableCell className="w-[210px]">
          <div className="flex w-full items-center gap-2">
            <Progress value={pct} className="w-full" />
            <span className="w-10 text-right font-mono text-xs">{pct}%</span>
          </div>
        </TableCell>
      )}

      {/* em_curso variant: Total Value, P/A/C dots, Pendente, Actions */}
      {isEmCurso && (
        <>
          {/* Total Value */}
          <TableCell className="w-[120px] text-right text-sm font-mono">
            {jobTotalValue !== null && jobTotalValue !== undefined && jobTotalValue > 0
              ? new Intl.NumberFormat("pt-PT", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(jobTotalValue)
              : "—"}
          </TableCell>

          {/* P (Prioridade) dot */}
          <TableCell className="w-[36px] p-0 text-center">
            <button
              className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getPColor(job)}`}
              title={
                job.prioridade
                  ? "Prioritário"
                  : job.data_in &&
                      (Date.now() - new Date(job.data_in).getTime()) /
                        (1000 * 60 * 60 * 24) >
                        3
                    ? "Aguardando há mais de 3 dias"
                    : "Normal"
              }
              onClick={() => onPrioridadeClick?.(job)}
            />
          </TableCell>

          {/* A (Artes Finais) dot */}
          <TableCell className="w-[36px] p-0 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <span
                      className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getAColor(job.id, jobItems, designerItems)}`}
                      title="Artes Finais"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Artes Finais</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>

          {/* C (Corte) dot */}
          <TableCell className="w-[36px] p-0 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <span
                      className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getCColor(job.id, operacoes)}`}
                      title="Corte"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Corte</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>

          {/* Pendente Checkbox */}
          <TableCell className="w-[40px] p-0 text-center">
            <Checkbox
              checked={job.pendente ?? false}
              onCheckedChange={(checked) => {
                const newPendente = checked === true;
                onPendenteChange?.(job, newPendente);
              }}
            />
          </TableCell>

          {/* View/Delete Actions */}
          <TableCell className={isMobile ? "w-[50px] p-0 pr-2" : "w-[100px] p-0 pr-2"}>
            <div className="flex justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ViewButton
                      onClick={() => onViewClick?.(job.id)}
                      title="Ver items"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Items</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* Delete button - hidden on mobile */}
              {!isMobile && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => onDeleteClick?.(job)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Eliminar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </TableCell>
        </>
      )}

      {/* concluidos variant: Items completed checkbox */}
      {!isEmCurso && (
        <TableCell className="w-[36px] p-0 text-center">
          <Checkbox
            checked={allItemsCompleted}
            onCheckedChange={(checked) => {
              if (jobItems.length === 0) return;
              const newStatus = !allItemsCompleted;
              onItemsConcluidoChange?.(job, newStatus, jobItems);
            }}
          />
        </TableCell>
      )}
    </TableRow>
  );
}

export const JobTableRow = memo(JobTableRowInternal);
