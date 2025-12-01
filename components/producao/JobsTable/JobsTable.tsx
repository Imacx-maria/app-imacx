"use client";

import { useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { JobTableRow } from "./JobTableRow";
import type { JobsTableProps } from "./types";
import type { Job, SortableJobKey } from "@/types/producao";

/**
 * Reusable jobs table component for production page
 * Consolidates the duplicate table logic from em_curso, pendentes, and concluidos tabs
 */
export function JobsTable({
  jobs,
  allItems,
  allOperacoes,
  allDesignerItems,
  clientes,
  jobsCompletionStatus,
  jobTotalValues,
  loading,
  variant,
  sortCol,
  sortDir,
  onToggleSort,
  onJobsUpdate,
  onJobDelete,
  onOpenDrawer,
  onClientesUpdate,
  onAllItemsUpdate,
  checkOrcDuplicate,
  checkFoDuplicate,
  prefillAndInsertFromOrc,
  prefillAndInsertFromFo,
  setDuplicateDialog,
  supabase,
}: JobsTableProps) {
  const isMobile = useIsMobile();
  
  // Memoized job update handler
  const handleJobUpdate = useCallback(
    (jobId: string, updates: Partial<Job>) => {
      onJobsUpdate((prevJobs) =>
        prevJobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
      );
    },
    [onJobsUpdate]
  );

  // Memoized delete handler
  const handleJobDelete = useCallback(
    async (jobId: string) => {
      try {
        const { error: deleteError } = await supabase
          .from("folhas_obras")
          .delete()
          .eq("id", jobId);

        if (deleteError) {
          throw deleteError;
        }

        // Update local state
        onJobsUpdate((prevJobs) => prevJobs.filter((j) => j.id !== jobId));
        onAllItemsUpdate((prevItems) =>
          prevItems.filter((item) => item.folha_obra_id !== jobId)
        );
      } catch (error) {
        console.error("Error deleting job:", error);
        alert("Erro ao eliminar a Folha de Obra. Tente novamente.");
      }
    },
    [supabase, onJobsUpdate, onAllItemsUpdate]
  );

  // Render sort indicator
  const renderSortIndicator = (col: SortableJobKey) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  // Header cell component for sortable columns
  const SortableHeader = ({
    col,
    label,
    tooltip,
    className,
  }: {
    col: SortableJobKey;
    label: string;
    tooltip?: string;
    className: string;
  }) => {
    const content = (
      <span>
        {label} {renderSortIndicator(col)}
      </span>
    );

    if (tooltip) {
      return (
        <TableHead
          onClick={() => onToggleSort(col)}
          className={`${className} sticky top-0 z-10 cursor-pointer imx-border-b bg-primary text-primary-foreground uppercase select-none`}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableHead>
      );
    }

    return (
      <TableHead
        onClick={() => onToggleSort(col)}
        className={`${className} sticky top-0 z-10 cursor-pointer imx-border-b bg-primary text-primary-foreground uppercase select-none`}
      >
        {content}
      </TableHead>
    );
  };

  const emptyMessage =
    variant === "em_curso"
      ? "Nenhum trabalho em curso encontrado."
      : variant === "pendentes"
        ? "Nenhum trabalho pendente encontrado."
        : "Nenhum trabalho concluído encontrado.";

  // Concluidos has 8 columns: Data, ORC, FO, Cliente, Campanha, Nota, Status, C
  // Em Curso/Pendentes have 13 columns: Data, ORC, FO, Cliente, Campanha, Nota, Status, Valor, P, A, C, SB, Actions
  const colSpan = variant === "concluidos" ? 8 : 13;

  return (
    <div className="bg-background w-full">
      <div className="w-full">
        <Table className="w-full imx-table-compact">
          <TableHeader>
            <TableRow>
              <SortableHeader
                col="created_at"
                label="Data"
                className="w-[90px] overflow-hidden text-center text-ellipsis whitespace-nowrap"
              />
              <SortableHeader
                col="numero_orc"
                label="ORC"
                className="w-[90px] max-w-[90px] overflow-hidden text-center text-ellipsis whitespace-nowrap"
              />
              <SortableHeader
                col="numero_fo"
                label="FO"
                className="w-[90px] max-w-[90px] overflow-hidden text-center text-ellipsis whitespace-nowrap"
              />
              <SortableHeader col="cliente" label="Cliente" className="w-[200px]" />
              <SortableHeader
                col="nome_campanha"
                label="Nome Campanha"
                className="flex-1"
              />
              <SortableHeader col="notas" label="Nota" className="w-[50px]" />
              <SortableHeader
                col="prioridade"
                label="Status"
                className="w-[210px]"
              />
              {variant === "concluidos" ? (
                /* Concluidos tab - only show C (Concluído) column */
                <TableHead className="sticky top-0 z-10 w-[36px] imx-border-b bg-primary p-0 text-center text-primary-foreground uppercase select-none">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>C</span>
                      </TooltipTrigger>
                      <TooltipContent>Concluído</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
              ) : (
                /* Em Curso and Pendentes tabs - full columns */
                <>
                  <SortableHeader
                    col="total_value"
                    label="Valor"
                    className="w-[120px] text-right"
                  />
                  <SortableHeader
                    col="prioridade"
                    label="P"
                    tooltip="Prioridade"
                    className="w-[36px] p-0 text-center"
                  />
                  <SortableHeader
                    col="artwork"
                    label="A"
                    tooltip="Artes Finais"
                    className="w-[36px] p-0 text-center"
                  />
                  <SortableHeader
                    col="corte"
                    label="C"
                    tooltip="Corte"
                    className="w-[36px] p-0 text-center"
                  />
                  <SortableHeader
                    col="pendente"
                    label="SB"
                    tooltip="Stand By"
                    className="w-[40px] text-center"
                  />
                  {/* Actions header - Delete button hidden on mobile */}
                  {!isMobile && (
                    <TableHead className="sticky top-0 z-10 w-[100px] imx-border-b bg-primary text-center text-primary-foreground uppercase">
                      Ações
                    </TableHead>
                  )}
                  {/* Mobile: Only show View button */}
                  {isMobile && (
                    <TableHead className="sticky top-0 z-10 w-[50px] imx-border-b bg-primary text-center text-primary-foreground uppercase">
                      Ações
                    </TableHead>
                  )}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <JobTableRow
                key={job.id}
                job={job}
                allItems={allItems}
                allOperacoes={allOperacoes}
                allDesignerItems={allDesignerItems}
                clientes={clientes}
                jobsCompletionStatus={jobsCompletionStatus}
                jobTotalValues={jobTotalValues}
                loading={loading}
                variant={variant}
                isMobile={isMobile}
                onJobUpdate={handleJobUpdate}
                onJobDelete={handleJobDelete}
                onOpenDrawer={onOpenDrawer}
                onClientesUpdate={onClientesUpdate}
                checkOrcDuplicate={checkOrcDuplicate}
                checkFoDuplicate={checkFoDuplicate}
                prefillAndInsertFromOrc={prefillAndInsertFromOrc}
                prefillAndInsertFromFo={prefillAndInsertFromFo}
                setDuplicateDialog={setDuplicateDialog}
                supabase={supabase}
              />
            ))}
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
