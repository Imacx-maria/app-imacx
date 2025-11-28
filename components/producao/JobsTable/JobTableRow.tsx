"use client";

import { memo, useCallback } from "react";
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
import CreatableClienteCombobox from "@/components/forms/CreatableClienteCombobox";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";
import { ViewButton } from "@/components/custom/ActionButtons";
import { formatDatePortuguese } from "@/utils/producao/dateHelpers";
import { getPColor, getAColor, getCColor } from "@/utils/producao/statusColors";
import type { JobTableRowProps } from "./types";
import type { Job, ClienteOption } from "@/types/producao";

/**
 * Memoized table row component for production jobs
 * Handles inline editing, validation, and actions for a single job row
 */
const JobTableRowComponent = ({
  job,
  allItems,
  allOperacoes,
  allDesignerItems,
  clientes,
  jobsCompletionStatus,
  jobTotalValues,
  loading,
  variant,
  onJobUpdate,
  onJobDelete,
  onOpenDrawer,
  onClientesUpdate,
  checkOrcDuplicate,
  checkFoDuplicate,
  prefillAndInsertFromOrc,
  prefillAndInsertFromFo,
  setDuplicateDialog,
  supabase,
}: JobTableRowProps) => {
  const pct = jobsCompletionStatus[job.id]?.percentage || 0;

  // Memoized handler for ORC input blur
  // Note: ORC duplicates are allowed, only FO duplicates are blocked
  const handleOrcBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value.trim();
      const value = inputValue === "" ? null : inputValue;

      // For temp jobs with a value, create from ORC
      if (job.id.startsWith("temp-") && inputValue) {
        try {
          await prefillAndInsertFromOrc(inputValue, job.id);
        } catch (error) {
          console.error("Error creating job from ORC:", error);
        }
        return;
      }

      // For existing jobs, just update the value (no duplicate check)
      if (!job.id.startsWith("temp-")) {
        await supabase
          .from("folhas_obras")
          .update({ numero_orc: value })
          .eq("id", job.id);
      }
    },
    [job.id, prefillAndInsertFromOrc, supabase],
  );

  // Memoized handler for FO input blur
  const handleFoBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();

      if (job.id.startsWith("temp-") && value) {
        const existingJob = await checkFoDuplicate(value, "");

        if (existingJob) {
          setDuplicateDialog({
            isOpen: true,
            type: "fo",
            value: value,
            existingJob,
            currentJobId: job.id,
            originalValue: "",
            onConfirm: async () => {
              try {
                await prefillAndInsertFromFo(value, job.id);
              } catch (error) {
                console.error("Error creating job from FO:", error);
              }
              setDuplicateDialog({
                isOpen: false,
                type: "fo",
                value: "",
                currentJobId: "",
              });
            },
            onCancel: () => {
              onJobUpdate(job.id, { numero_fo: "" });
              setDuplicateDialog({
                isOpen: false,
                type: "fo",
                value: "",
                currentJobId: "",
              });
            },
          });
        } else {
          try {
            await prefillAndInsertFromFo(value, job.id);
          } catch (error) {
            console.error("Error creating job from FO:", error);
          }
        }
      } else if (!job.id.startsWith("temp-")) {
        if (value) {
          const existingJob = await checkFoDuplicate(value, job.id);

          if (existingJob) {
            setDuplicateDialog({
              isOpen: true,
              type: "fo",
              value: value,
              existingJob,
              currentJobId: job.id,
              originalValue: job.numero_fo,
              onConfirm: async () => {
                await supabase
                  .from("folhas_obras")
                  .update({ Numero_do_: value })
                  .eq("id", job.id);
                setDuplicateDialog({
                  isOpen: false,
                  type: "fo",
                  value: "",
                  currentJobId: "",
                });
              },
              onCancel: () => {
                onJobUpdate(job.id, { numero_fo: job.numero_fo });
                setDuplicateDialog({
                  isOpen: false,
                  type: "fo",
                  value: "",
                  currentJobId: "",
                });
              },
            });
          } else {
            await supabase
              .from("folhas_obras")
              .update({ Numero_do_: value })
              .eq("id", job.id);
          }
        } else {
          await supabase
            .from("folhas_obras")
            .update({ Numero_do_: value })
            .eq("id", job.id);
        }
      }
    },
    [
      job.id,
      job.numero_fo,
      checkFoDuplicate,
      prefillAndInsertFromFo,
      setDuplicateDialog,
      onJobUpdate,
      supabase,
    ],
  );

  // Memoized handler for cliente change
  const handleClienteChange = useCallback(
    async (selectedId: string) => {
      const selected = clientes.find((c) => c.value === selectedId);
      onJobUpdate(job.id, {
        id_cliente: selectedId,
        cliente: selected ? selected.label : "",
      });

      if (!job.id.startsWith("temp-")) {
        const selectedCustomerId = selected
          ? parseInt(selected.value, 10)
          : null;
        await supabase
          .from("folhas_obras")
          .update({
            Nome: selected?.label || "",
            customer_id: selectedCustomerId,
          })
          .eq("id", job.id);
      }
    },
    [job.id, clientes, onJobUpdate, supabase],
  );

  // Memoized handler for campaign name blur
  const handleCampaignBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!job.id.startsWith("temp-")) {
        await supabase
          .from("folhas_obras")
          .update({ Trabalho: value })
          .eq("id", job.id);
      }
    },
    [job.id, supabase],
  );

  // Memoized handler for notes save
  const handleNotesSave = useCallback(
    async (newNotas: string) => {
      await supabase
        .from("folhas_obras")
        .update({ notas: newNotas })
        .eq("id", job.id);
      onJobUpdate(job.id, { notas: newNotas });
    },
    [job.id, onJobUpdate, supabase],
  );

  // Memoized handler for priority toggle
  const handlePriorityToggle = useCallback(async () => {
    const newPrioridade = !job.prioridade;
    onJobUpdate(job.id, { prioridade: newPrioridade });
    await supabase
      .from("folhas_obras")
      .update({ prioridade: newPrioridade })
      .eq("id", job.id);
  }, [job.id, job.prioridade, onJobUpdate, supabase]);

  // Memoized handler for pendente toggle
  const handlePendenteChange = useCallback(
    async (checked: boolean | "indeterminate") => {
      const previousPendente = job.pendente ?? false;
      const newPendente = checked === true;

      // The parent will handle removing from the list
      onJobUpdate(job.id, { pendente: newPendente });

      if (!job.id.startsWith("temp-")) {
        try {
          await supabase
            .from("folhas_obras")
            .update({ pendente: newPendente })
            .eq("id", job.id);
        } catch (error) {
          console.error("Error updating pendente status:", error);
          onJobUpdate(job.id, { pendente: previousPendente });
        }
      }
    },
    [job.id, job.pendente, onJobUpdate, supabase],
  );

  // Memoized handler for delete
  const handleDelete = useCallback(async () => {
    if (
      !confirm(
        `Tem certeza que deseja eliminar a Folha de Obra ${job.numero_fo}? Esta ação irá eliminar todos os itens e dados logísticos associados.`,
      )
    ) {
      return;
    }
    await onJobDelete(job.id);
  }, [job.id, job.numero_fo, onJobDelete]);

  // Format valor display
  const valorDisplay = (() => {
    const valor = job.euro_tota ?? jobTotalValues[job.id] ?? null;
    return valor !== null && valor > 0
      ? new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(valor)
      : "—";
  })();

  return (
    <TableRow className="imx-row-hover">
      {/* Data */}
      <TableCell className="w-[90px] text-center text-xs">
        {formatDatePortuguese(job.data_in)}
      </TableCell>

      {/* ORC */}
      <TableCell className="w-[90px] max-w-[90px]">
        <Input
          type="text"
          maxLength={6}
          value={job.numero_orc ?? ""}
          onChange={(e) => {
            const value = e.target.value === "" ? null : e.target.value;
            onJobUpdate(job.id, { numero_orc: value });
          }}
          onBlur={handleOrcBlur}
          className="h-10 text-right text-sm"
          placeholder="ORC"
        />
      </TableCell>

      {/* FO */}
      <TableCell className="w-[90px] max-w-[90px]">
        <Input
          maxLength={6}
          value={job.numero_fo}
          onChange={(e) => {
            onJobUpdate(job.id, { numero_fo: e.target.value });
          }}
          onBlur={handleFoBlur}
          className="h-10 text-right text-sm"
          placeholder="FO"
        />
      </TableCell>

      {/* Cliente */}
      <TableCell className="w-[200px]">
        <CreatableClienteCombobox
          value={job.id_cliente || ""}
          onChange={handleClienteChange}
          options={clientes}
          onOptionsUpdate={onClientesUpdate}
          placeholder="Cliente"
          disabled={loading.clientes}
          loading={loading.clientes}
          displayLabel={job.cliente || undefined}
        />
      </TableCell>

      {/* Nome Campanha */}
      <TableCell className="flex-1">
        <Input
          value={job.nome_campanha}
          onChange={(e) => {
            onJobUpdate(job.id, { nome_campanha: e.target.value });
          }}
          onBlur={handleCampaignBlur}
          className="h-10 w-full text-sm"
          placeholder="Nome da Campanha"
        />
      </TableCell>

      {/* Notas */}
      <TableCell className="w-[50px] text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <SimpleNotasPopover
                  value={job.notas ?? ""}
                  onSave={handleNotesSave}
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

      {/* Status (Progress) */}
      <TableCell className="w-[210px]">
        <div className="flex w-full items-center gap-2">
          <Progress value={pct} className="w-full" />
          <span className="w-10 text-right font-mono text-xs">{pct}%</span>
        </div>
      </TableCell>

      {/* Concluidos variant has simplified columns */}
      {variant === "concluidos" ? (
        /* Concluído checkbox for concluidos tab */
        <TableCell className="w-[36px] p-0 text-center">
          <Checkbox checked={job.concluido ?? true} disabled />
        </TableCell>
      ) : (
        <>
          {/* Valor */}
          <TableCell className="w-[120px] text-right text-sm font-mono">
            {valorDisplay}
          </TableCell>

          {/* Prioridade (P) */}
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
              onClick={handlePriorityToggle}
            />
          </TableCell>

          {/* Artwork (A) */}
          <TableCell className="w-[36px] p-0 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <span
                      className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getAColor(job.id, allItems, allDesignerItems)}`}
                      title="Artes Finais"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Artes Finais</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>

          {/* Corte (C) */}
          <TableCell className="w-[36px] p-0 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <span
                      className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getCColor(job.id, allOperacoes)}`}
                      title="Corte"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Corte</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>

          {/* Pendente (SB) */}
          <TableCell className="w-[40px] p-0 text-center">
            <Checkbox
              checked={job.pendente ?? false}
              onCheckedChange={handlePendenteChange}
            />
          </TableCell>

          {/* Actions */}
          <TableCell className="w-[100px] p-0 pr-2">
            <div className="flex justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ViewButton
                      onClick={() => onOpenDrawer(job.id)}
                      title="Ver items"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Items</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eliminar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>
        </>
      )}
    </TableRow>
  );
};

/**
 * Memoized JobTableRow - only re-renders when relevant props change
 */
export const JobTableRow = memo(
  JobTableRowComponent,
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    // Only re-render if these specific values change
    return (
      prevProps.job.id === nextProps.job.id &&
      prevProps.job.numero_orc === nextProps.job.numero_orc &&
      prevProps.job.numero_fo === nextProps.job.numero_fo &&
      prevProps.job.nome_campanha === nextProps.job.nome_campanha &&
      prevProps.job.cliente === nextProps.job.cliente &&
      prevProps.job.id_cliente === nextProps.job.id_cliente &&
      prevProps.job.notas === nextProps.job.notas &&
      prevProps.job.prioridade === nextProps.job.prioridade &&
      prevProps.job.pendente === nextProps.job.pendente &&
      prevProps.job.data_in === nextProps.job.data_in &&
      prevProps.job.euro_tota === nextProps.job.euro_tota &&
      prevProps.jobsCompletionStatus[prevProps.job.id]?.percentage ===
        nextProps.jobsCompletionStatus[nextProps.job.id]?.percentage &&
      prevProps.jobTotalValues[prevProps.job.id] ===
        nextProps.jobTotalValues[nextProps.job.id] &&
      prevProps.variant === nextProps.variant &&
      prevProps.loading.clientes === nextProps.loading.clientes &&
      prevProps.clientes.length === nextProps.clientes.length
    );
  },
);

JobTableRow.displayName = "JobTableRow";
