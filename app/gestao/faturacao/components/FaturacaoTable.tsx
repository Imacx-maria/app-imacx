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
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { ItemRow, SortConfig } from "../types";

interface FaturacaoTableProps {
  items: ItemRow[];
  sortConfigs: SortConfig[];
  onSort: (column: string, isShiftKey: boolean) => void;
  onToggleFacturado: (itemId: string, currentValue: boolean) => void;
  loading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function FaturacaoTable({
  items,
  sortConfigs,
  onSort,
  onToggleFacturado,
  loading,
  currentPage,
  totalPages,
  onPageChange,
}: FaturacaoTableProps) {
  // Helper to render sort indicator
  const renderSortIndicator = (column: string) => {
    const sortConfig = sortConfigs.find((config) => config.column === column);
    if (!sortConfig) return <span className="inline-block w-3 h-3" />;

    const sortIndex = sortConfigs.findIndex(
      (config) => config.column === column
    );
    const showOrder = sortConfigs.length > 1;

    return (
      <span className="inline-flex items-center gap-0.5 w-auto min-w-[12px]">
        {sortConfig.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        {showOrder && (
          <span className="text-[10px] font-bold">{sortIndex + 1}</span>
        )}
      </span>
    );
  };

  // Helper function to truncate text
  const truncateText = (
    text: string | null | undefined,
    maxLength: number
  ): string => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="w-full space-y-4">
      <Table className="w-full table-fixed imx-table-compact">
        <TableHeader>
          <TableRow className="imx-border-b ">
            <TableHead
              className="w-20 text-center cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("numero_fo", e.shiftKey)}
            >
              <div className="flex items-center justify-center gap-1">
                FO
                {renderSortIndicator("numero_fo")}
              </div>
            </TableHead>
            <TableHead
              className="w-20 text-center cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("numero_orc", e.shiftKey)}
            >
              <div className="flex items-center justify-center gap-1">
                ORC
                {renderSortIndicator("numero_orc")}
              </div>
            </TableHead>
            <TableHead
              className="w-[200px] cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("cliente", e.shiftKey)}
            >
              <div className="flex items-center gap-1">
                Cliente
                {renderSortIndicator("cliente")}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("nome_campanha", e.shiftKey)}
            >
              <div className="flex items-center gap-1">
                Campanha
                {renderSortIndicator("nome_campanha")}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("descricao", e.shiftKey)}
            >
              <div className="flex items-center gap-1">
                Item
                {renderSortIndicator("descricao")}
              </div>
            </TableHead>
            <TableHead
              className="w-[130px] cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("created_at", e.shiftKey)}
            >
              <div className="flex items-center gap-1">
                Data Criação
                {renderSortIndicator("created_at")}
              </div>
            </TableHead>
            <TableHead
              className="w-[130px] cursor-pointer bg-primary text-primary-foreground font-bold uppercase"
              onClick={(e) => onSort("data_saida", e.shiftKey)}
            >
              <div className="flex items-center gap-1">
                Data Saída
                {renderSortIndicator("data_saida")}
              </div>
            </TableHead>
            <TableHead
              className="w-[80px] cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center"
              onClick={(e) => onSort("dias", e.shiftKey)}
            >
              <div className="flex items-center justify-center gap-1">
                Dias
                {renderSortIndicator("dias")}
              </div>
            </TableHead>
            <TableHead
              className="w-10 cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center"
              onClick={(e) => onSort("concluido", e.shiftKey)}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center justify-center gap-1">
                      C{renderSortIndicator("concluido")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Logística Concluída</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
            <TableHead className="w-10 bg-primary text-primary-foreground font-bold uppercase text-center">
              F
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="h-40 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="text-center text-muted-foreground py-8"
              >
                Nenhum item encontrado
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted">
                <TableCell className="w-20 text-center font-mono font-bold">
                  {item.numero_fo}
                </TableCell>
                <TableCell className="w-20 text-center font-mono">
                  {item.numero_orc || "-"}
                </TableCell>
                <TableCell className="w-[200px]">{truncateText(item.cliente, 20)}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {item.nome_campanha}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {item.descricao}
                </TableCell>
                <TableCell className="w-[130px]">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString("pt-PT")
                    : "-"}
                </TableCell>
                <TableCell className="w-[130px]">
                  {item.data_saida
                    ? new Date(item.data_saida).toLocaleDateString("pt-PT")
                    : "-"}
                </TableCell>
                <TableCell
                  className={`w-[80px] text-center font-semibold ${
                    item.data_saida
                      ? "text-success dark:text-success"
                      : item.dias_em_progresso
                      ? "text-orange-600 dark:text-orange-400"
                      : ""
                  }`}
                >
                  {item.dias_trabalho || "-"}
                </TableCell>
                <TableCell className="w-10 text-center">
                  <div className="flex justify-center">
                    <div
                      className={`h-4 w-4 imx-border rounded-sm flex items-center justify-center ${
                        item.concluido ? "bg-black" : "bg-transparent"
                      }`}
                    >
                      {item.concluido && (
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M10 3L4.5 8.5L2 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="w-10 text-center">
                  <div className="flex justify-center">
                    <div
                      className={`h-4 w-4 imx-border rounded-sm cursor-pointer flex items-center justify-center ${
                        item.facturado ? "bg-black" : "bg-transparent"
                      }`}
                      onClick={() =>
                        onToggleFacturado(item.id, !item.facturado)
                      }
                    >
                      {item.facturado && (
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M10 3L4.5 8.5L2 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
          <div className="text-muted-foreground">
            Página {currentPage} de {totalPages} ({items.length} itens)
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
  );
}
