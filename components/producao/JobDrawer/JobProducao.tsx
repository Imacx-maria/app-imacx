"use client";

import { memo, useMemo, useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Copy,
  X,
  Check,
  Edit,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Job, Item } from "./types";

export interface JobProducaoProps {
  job: Job;
  jobItems: Item[];
  supabase: any;

  // State management
  editingItems: Set<string>;
  tempValues: { [itemId: string]: Partial<Item> };
  savingItems: Set<string>;
  pendingItems: { [itemId: string]: Item };

  // Callbacks
  onAddItem: () => void;
  onAcceptItem: (item: Item) => Promise<void>;
  onSaveItem: (item: Item) => Promise<void>;
  onCancelEdit: (itemId: string) => void;
  onDuplicateItem: (item: Item) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
  onUpdateTempValue: (itemId: string, field: keyof Item, value: any) => void;
  onBrindesChange: (itemId: string, value: boolean) => Promise<void>;
  onStartEdit: (itemId: string, item: Item) => void;

  // Utility functions
  isEditing: (itemId: string) => boolean;
  isSaving: (itemId: string) => boolean;
  isNewItem: (itemId: string) => boolean;
  isPending: (itemId: string) => boolean;
  getDisplayValue: (item: Item, field: keyof Item) => any;
}

type SortKey = "bulk" | "descricao" | "codigo" | "quantidade" | "acoes";

/**
 * JobProducao Component
 * Handles the "Produção" tab - displays and manages production items
 */
function JobProducaoComponent({
  job,
  jobItems,
  supabase,
  editingItems,
  tempValues,
  savingItems,
  pendingItems,
  onAddItem,
  onAcceptItem,
  onSaveItem,
  onCancelEdit,
  onDuplicateItem,
  onDeleteItem,
  onUpdateTempValue,
  onBrindesChange,
  onStartEdit,
  isEditing,
  isSaving,
  isNewItem,
  isPending,
  getDisplayValue,
}: JobProducaoProps) {
  const [sortCol, setSortCol] = useState<SortKey | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const toggleSort = useCallback((col: SortKey) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return col;
      } else {
        setSortDir("asc");
        return col;
      }
    });
  }, []);

  const sortedItems = useMemo(() => {
    if (!sortCol) return jobItems;

    const arr = [...jobItems];
    arr.sort((a, b) => {
      let A: any, B: any;
      switch (sortCol) {
        case "bulk":
          A = a.id;
          B = b.id;
          break;
        case "descricao":
          A = a.descricao;
          B = b.descricao;
          break;
        case "codigo":
          A = a.codigo || "";
          B = b.codigo || "";
          break;
        case "quantidade":
          A = a.quantidade ?? 0;
          B = b.quantidade ?? 0;
          break;
        case "acoes":
          A = a.id;
          B = b.id;
          break;
        default:
          A = a.id;
          B = b.id;
      }
      if (typeof A === "string")
        return sortDir === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      if (typeof A === "number") return sortDir === "asc" ? A - B : B - A;
      if (typeof A === "boolean") return sortDir === "asc" ? +A - +B : +B - +A;
      return 0;
    });
    return arr;
  }, [jobItems, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage]);

  // Reset to page 1 when jobItems changes
  useEffect(() => {
    setCurrentPage(1);
  }, [jobItems.length]);

  return (
    <div className="mt-6">
      {/* Header & toolbar */}
      <div className="mb-6">
        <div className="p-0">
          <h2 className="text-lg font-semibold">
            {job.concluido ? "Trabalho" : "Novo Trabalho"} (FO: {job.numero_fo})
          </h2>
          <p className="text-muted-foreground text-sm">
            Detalhes Produção Folha de Obra
          </p>
        </div>
      </div>

      {/* Add Item Button */}
      <div className="mb-4 flex justify-end">
        <Button variant="default" size="sm" onClick={onAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      {/* Production Items table */}
      <Table className="w-full imx-table-compact">
        <TableHeader>
          <TableRow className="imx-border-b bg-transparent">
            <TableHead
              className="w-10 cursor-pointer imx-border-b bg-primary text-center text-primary-foreground uppercase select-none"
              onClick={() => toggleSort("bulk")}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      B{" "}
                      {sortCol === "bulk" &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="ml-1 inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 inline h-3 w-3" />
                        ))}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Brindes</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
            <TableHead
              className="cursor-pointer imx-border-b bg-primary text-primary-foreground uppercase select-none"
              onClick={() => toggleSort("descricao")}
            >
              Item{" "}
              {sortCol === "descricao" &&
                (sortDir === "asc" ? (
                  <ArrowUp className="ml-1 inline h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 inline h-3 w-3" />
                ))}
            </TableHead>
            <TableHead
              className="w-72 cursor-pointer imx-border-b bg-primary text-primary-foreground uppercase select-none"
              onClick={() => toggleSort("codigo")}
            >
              Código{" "}
              {sortCol === "codigo" &&
                (sortDir === "asc" ? (
                  <ArrowUp className="ml-1 inline h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 inline h-3 w-3" />
                ))}
            </TableHead>
            <TableHead
              className="w-24 cursor-pointer imx-border-b bg-primary text-primary-foreground uppercase select-none"
              onClick={() => toggleSort("quantidade")}
            >
              Quantidade{" "}
              {sortCol === "quantidade" &&
                (sortDir === "asc" ? (
                  <ArrowUp className="ml-1 inline h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 inline h-3 w-3" />
                ))}
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer imx-border-b bg-primary text-center text-primary-foreground uppercase select-none">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center">
                Nenhum item encontrado
              </TableCell>
            </TableRow>
          ) : (
            paginatedItems.map((it, index) => (
              <TableRow
                key={it.id || `item-${index}`}
                className={`hover:bg-accent transition-colors ${isEditing(it.id) ? "bg-accent/10" : ""}`}
              >
                <TableCell className="text-center">
                  <Checkbox
                    checked={!!getDisplayValue(it, "brindes")}
                    disabled={isEditing(it.id)}
                    onCheckedChange={async (checked) => {
                      if (isEditing(it.id)) return;
                      const value =
                        checked === "indeterminate" ? false : checked;
                      await onBrindesChange(it.id, value);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={String(getDisplayValue(it, "descricao") || "")}
                    onChange={(e) => {
                      if (isEditing(it.id)) {
                        onUpdateTempValue(it.id, "descricao", e.target.value);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isEditing(it.id) && !isNewItem(it.id)) {
                        onStartEdit(it.id, it);
                      }
                    }}
                    disabled={!isEditing(it.id) && !isNewItem(it.id)}
                    className="disabled:text-foreground h-10 text-sm disabled:cursor-pointer disabled:opacity-100"
                    placeholder="Descrição do item"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={String(getDisplayValue(it, "codigo") || "")}
                    onChange={(e) => {
                      if (isEditing(it.id)) {
                        onUpdateTempValue(it.id, "codigo", e.target.value);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isEditing(it.id) && !isNewItem(it.id)) {
                        onStartEdit(it.id, it);
                      }
                    }}
                    disabled={!isEditing(it.id) && !isNewItem(it.id)}
                    className="disabled:text-foreground h-10 text-sm disabled:cursor-pointer disabled:opacity-100"
                    placeholder="Código do item"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="text"
                    value={String(getDisplayValue(it, "quantidade") ?? "")}
                    onChange={(e) => {
                      if (isEditing(it.id)) {
                        const value = e.target.value.trim();
                        const numValue = value === "" ? null : Number(value);
                        onUpdateTempValue(it.id, "quantidade", numValue);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isEditing(it.id) && !isNewItem(it.id)) {
                        onStartEdit(it.id, it);
                      }
                    }}
                    disabled={!isEditing(it.id) && !isNewItem(it.id)}
                    className="disabled:text-foreground h-10 w-20 text-right text-sm disabled:cursor-pointer disabled:opacity-100"
                    placeholder="Qtd"
                  />
                </TableCell>
                <TableCell className="w-[130px] min-w-[130px] p-2 text-sm">
                  {isEditing(it.id) ? (
                    // Save/Cancel buttons for editing mode
                    <div className="flex justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="default"
                              className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 imx-border"
                              onClick={() =>
                                isPending(it.id)
                                  ? onAcceptItem(it)
                                  : onSaveItem(it)
                              }
                              disabled={isSaving(it.id)}
                            >
                              {isSaving(it.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isPending(it.id) ? "Aceitar" : "Salvar"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 imx-border"
                              onClick={() => onCancelEdit(it.id)}
                              disabled={isSaving(it.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cancelar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : (
                    // Normal edit/duplicate/delete buttons
                    <div className="flex justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 imx-border"
                              onClick={() => {
                                if (!isNewItem(it.id)) {
                                  onStartEdit(it.id, it);
                                }
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 imx-border"
                              onClick={() => onDuplicateItem(it)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 imx-border"
                              onClick={() => onDeleteItem(it.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between imx-border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({sortedItems.length} items)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
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

export const JobProducao = memo(JobProducaoComponent);
