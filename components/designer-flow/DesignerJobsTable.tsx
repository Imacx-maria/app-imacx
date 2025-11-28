"use client"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ViewButton } from "@/components/ui/action-buttons"
import { getAColor } from "@/utils/producao/statusColors"
import { PriorityIndicator } from "./PriorityIndicator"
import type { Job, Item } from "@/app/designer-flow/types"
import type { PriorityColor } from "@/app/designer-flow/lib/helpers"
import { getPriorityColor } from "@/app/designer-flow/lib/helpers"
import { DesignerSelector } from "./DesignerSelector"
import { formatDate } from "@/utils/date"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export type SortColumn =
  | "prioridade"
  | "artwork"
  | "numero_fo"
  | "numero_orc"
  | "nome_campanha"
  | "designer"
  | "created_at"
  | "cliente"

interface DesignerJobsTableProps {
  jobsLength: number
  paginatedJobs: Job[]
  allItems: Item[]
  allDesignerItems: any[]
  jobDesigners: Record<string, string>
  sortColumn: SortColumn
  sortDirection: "asc" | "desc"
  onSort: (column: SortColumn) => void
  onSelectJob: (job: Job) => void
  selectedJobId: string | null
  supabase: any
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const DesignerJobsTable = ({
  jobsLength,
  paginatedJobs,
  allItems,
  allDesignerItems,
  jobDesigners,
  sortColumn,
  sortDirection,
  onSort,
  onSelectJob,
  selectedJobId,
  supabase,
  currentPage,
  totalPages,
  onPageChange,
}: DesignerJobsTableProps) => {
  return (
    <div className="w-full space-y-4">
      <Table className="w-full table-fixed imx-table-compact">
        <TableHeader>
          <TableRow>
            {renderSortableHead("P", "prioridade", sortColumn, sortDirection, onSort, "w-10 text-center")}
            {renderSortableHead("A", "artwork", sortColumn, sortDirection, onSort, "w-10 text-center")}
            {renderSortableHead("FO", "numero_fo", sortColumn, sortDirection, onSort, "w-20 text-center")}
            {renderSortableHead("ORC", "numero_orc", sortColumn, sortDirection, onSort, "w-20 text-center")}
            {renderSortableHead("Cliente", "cliente", sortColumn, sortDirection, onSort, "")}
            {renderSortableHead("Campanha", "nome_campanha", sortColumn, sortDirection, onSort, "")}
            {renderSortableHead("Designer", "designer", sortColumn, sortDirection, onSort, "w-36")}
            {renderSortableHead("Criado", "created_at", sortColumn, sortDirection, onSort, "w-24")}
            <TableHead className="w-[90px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedJobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-4 text-center text-muted-foreground">
                Nenhum trabalho encontrado.
              </TableCell>
            </TableRow>
          ) : (
            paginatedJobs.map((job) => {
              const priority: PriorityColor = getPriorityColor(job)
              return (
                <TableRow
                  key={job.id}
                  className={cn(
                    "text-xs uppercase transition-colors",
                    selectedJobId === job.id ? "bg-accent" : "hover:bg-muted/40",
                  )}
                >
                  <TableCell className="w-10 text-center">
                    <div className="flex items-center justify-center">
                      <PriorityIndicator currentPriority={priority} />
                    </div>
                  </TableCell>
                  <TableCell className="w-10 text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <span
                              className={`mx-auto flex h-3 w-3 items-center justify-center rounded-full ${getAColor(job.id, allItems, allDesignerItems)}`}
                              title="Artes Finais"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Artes Finais</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="w-20 text-center font-medium">
                    {String(job.numero_fo).slice(0, 6)}
                  </TableCell>
                  <TableCell className="w-20 text-center">
                    {job.numero_orc ? String(job.numero_orc).slice(0, 6) : ""}
                  </TableCell>
                  <TableCell className="truncate" title={job.cliente || ""}>
                    {job.cliente || ""}
                  </TableCell>
                  <TableCell className="truncate" title={job.nome_campanha || ""}>
                    {job.nome_campanha}
                  </TableCell>
                  <TableCell className="w-36">
                    <DesignerSelector jobId={job.id} supabase={supabase} />
                  </TableCell>
                  <TableCell className="w-24">
                    {formatDate(job.created_at)}
                  </TableCell>
                  <TableCell className="w-[90px]">
                    <div className="flex h-full items-center justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ViewButton onClick={() => onSelectJob(job)} />
                          </TooltipTrigger>
                          <TooltipContent>Ver Itens</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
          <div className="text-muted-foreground">
            Página {currentPage} de {totalPages} ({jobsLength} trabalhos)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const renderSortableHead = (
  label: string,
  column: SortColumn,
  sortColumn: SortColumn,
  sortDirection: "asc" | "desc",
  onSort: (column: SortColumn) => void,
  className?: string,
) => {
  const isActive = sortColumn === column
  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive && (sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        ))}
      </div>
    </TableHead>
  )
}
