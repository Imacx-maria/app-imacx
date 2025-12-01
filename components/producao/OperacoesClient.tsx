"use client";

/**
 * Production Operations Client Component
 * --------------------------------------
 * Receives pre-fetched data from server component for fast initial render.
 *
 * FILTERING RULES:
 * - Only shows items from jobs that have both FO (numero_fo) and ORC (numero_orc) values
 * - Items must have paginação = true from designer_items
 * - Items must have incomplete logistica_entregas
 * - Items from jobs missing either FO or ORC are filtered out
 * - Both numero_fo and numero_orc cannot be null, 0, or "0000"
 * - Items must NOT be brindes
 * - Items must NOT have complexidade = 'OFFSET'
 * - Items must NOT be concluded (concluido = true)
 * - Items must NOT have completed operations (Corte or Impressao_Flexiveis)
 */

import React, { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createBrowserClient } from "@/utils/supabase";

import { fetchEnhancedAuditLogs } from "@/utils/auditLogging";
import { X, ArrowUp, ArrowDown, Loader2, RefreshCcw, Eye } from "lucide-react";
import { ProductionOperationsDrawer } from "@/components/producao/ProductionOperations";

// Types - exported for use in server component
export interface ProductionItem {
  id: string;
  folha_obra_id: string;
  descricao: string;
  codigo?: string | null;
  quantidade?: number | null;
  concluido?: boolean;
  concluido_maq?: boolean | null;
  brindes?: boolean;
  prioridade?: boolean | null;
  complexidade?: string | null;
  created_at?: string | null;
  data_in?: string | null;
  folhas_obras?: {
    numero_fo?: string;
    nome_campanha?: string;
    numero_orc?: number;
    prioridade?: boolean | null;
  } | null;
  designer_items?: {
    paginacao?: boolean;
    path_trabalho?: string;
  } | null;
  logistica_entregas?:
    | {
        concluido?: boolean;
      }[]
    | {
        concluido?: boolean;
      }
    | null;
  _operationsAllConcluded?: boolean;
  _hasOperations?: boolean;
}

type SortKey =
  | "numero_fo"
  | "nome_campanha"
  | "descricao"
  | "quantidade"
  | "prioridade";

// Props interface for SSR data
interface OperacoesClientProps {
  initialItems: ProductionItem[];
  initialError?: string | null;
}

export default function OperacoesClient({
  initialItems,
  initialError,
}: OperacoesClientProps) {
  const supabase = useMemo(() => createBrowserClient(), []);

  // State - initialized with server data (no loading spinner on initial render!)
  const [items, setItems] = useState<ProductionItem[]>(initialItems);
  const [completedItems, setCompletedItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(false); // Start as false since we have initial data
  const [completedLoading, setCompletedLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  // Tabs state
  const [currentTab, setCurrentTab] = useState<string>("operacoes");

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Audit log filters (persisted)
  const [logDateFrom, setLogDateFrom] = useState<Date | undefined>(undefined);
  const [logDateTo, setLogDateTo] = useState<Date | undefined>(undefined);
  const [logOperatorFilter, setLogOperatorFilter] = useState<string>("");
  const [logOpTypeFilter, setLogOpTypeFilter] = useState<string>("");
  const [logActionTypeFilter, setLogActionTypeFilter] = useState<string>("");
  const [logChangedByFilter, setLogChangedByFilter] = useState<string>("");

  // Filters
  const [foFilter, setFoFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");

  // Sorting
  const [sortCol, setSortCol] = useState<SortKey>("numero_fo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const toggleSort = useCallback(
    (col: SortKey) => {
      if (sortCol === col) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    },
    [sortCol, sortDir],
  );

  // Priority color helper - MUST match main producao page logic exactly
  // Reads from folhas_obras.prioridade (set on main page)
  const getPColor = (item: ProductionItem): string => {
    // RED: Priority explicitly set on main page
    if (item.folhas_obras?.prioridade === true) return "bg-destructive";

    // BLUE: Items older than 3 days (uses same field as main page)
    // NOTE: Main page uses data_in, but since that field doesn't exist yet,
    // we temporarily use created_at until migration is run
    if (item.created_at) {
      const days =
        (Date.now() - new Date(item.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days > 3) return "bg-info";
    }

    // GREEN: Normal items (no priority, < 3 days old)
    return "bg-success";
  };

  // Fetch data with proper filtering
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("Starting to fetch production items...");

      // First, test basic access
      const { data: testData, error: testError } = await supabase
        .from("items_base")
        .select("id")
        .limit(1);

      if (testError) {
        console.error("Basic items_base access failed:", testError);
        throw new Error(`Database access error: ${testError.message}`);
      }

      if (!testData || testData.length === 0) {
        console.log("No items found in items_base table");
        setItems([]);
        return;
      }

      // Fetch items with relations and apply database-level filters
      let query = supabase.from("items_base").select(`
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade,
          concluido,
          concluido_maq,
          brindes,
          prioridade,
          complexidade,
          created_at,
          folhas_obras!inner (
            Numero_do_,
            numero_orc,
            Trabalho,
            prioridade
          ),
          designer_items (
            paginacao,
            path_trabalho
          ),
          logistica_entregas (
            concluido
          )
        `);

      // Apply database-level filters
      // Filter out concluded items at database level
      query = query.or("concluido.is.null,concluido.eq.false");

      if (foFilter?.trim()) {
        query = query.ilike("folhas_obras.Numero_do_", `%${foFilter.trim()}%`);
      }
      if (itemFilter?.trim()) {
        query = query.ilike("descricao", `%${itemFilter.trim()}%`);
      }

      const { data: itemsData, error: itemsError } = await query;

      if (itemsError) {
        console.error("Complex query failed:", itemsError);
        throw new Error(
          `Failed to fetch items with relations: ${itemsError.message}`,
        );
      }

      console.log("Items query result:", itemsData?.length || 0, "items");

      if (!itemsData) {
        console.log("Query returned null/undefined data");
        setItems([]);
        return;
      }

      // Transform the data
      const transformedItems = itemsData.map((item) => {
        const transformedItem = {
          ...item,
          folhas_obras: Array.isArray(item.folhas_obras)
            ? item.folhas_obras[0]
            : item.folhas_obras,
          designer_items: Array.isArray(item.designer_items)
            ? item.designer_items[0]
            : item.designer_items,
          logistica_entregas: Array.isArray(item.logistica_entregas)
            ? item.logistica_entregas
            : item.logistica_entregas,
        };

        // Map database columns to expected interface properties
        if (transformedItem.folhas_obras) {
          const foData: any = transformedItem.folhas_obras;
          const mappedFo: any = {
            numero_orc: foData.numero_orc,
            prioridade: foData.prioridade, // ← ADD THIS! Keep priority from DB
          };
          if (foData.Numero_do_ !== undefined) {
            mappedFo.numero_fo = String(foData.Numero_do_);
          }
          if (foData.Trabalho !== undefined) {
            mappedFo.nome_campanha = foData.Trabalho;
          }
          transformedItem.folhas_obras = mappedFo;
        }

        return transformedItem;
      });

      console.log("Transformed items:", transformedItems.length);

      // Filter items that meet all conditions
      const filteredItems = transformedItems.filter((item) => {
        let hasLogisticaEntregasNotConcluida = false;

        if (item.logistica_entregas) {
          if (Array.isArray(item.logistica_entregas)) {
            hasLogisticaEntregasNotConcluida = (
              item.logistica_entregas as any[]
            ).some((entrega: any) => entrega.concluido === false);
          } else {
            hasLogisticaEntregasNotConcluida =
              (item.logistica_entregas as any).concluido === false;
          }
        }

        const hasPaginacaoTrue = item.designer_items?.paginacao === true;
        const isNotBrinde = item.brindes !== true;
        const isNotOffset = item.complexidade !== "OFFSET";
        const isNotConcluido = item.concluido !== true; // Item must not be concluded

        // Require both FO and ORC values
        const foData = item.folhas_obras as any;
        const hasFoValue =
          foData?.numero_fo &&
          foData?.numero_fo !== "0" &&
          foData?.numero_fo !== "0000";
        const hasOrcValue = foData?.numero_orc && foData?.numero_orc !== 0;

        const includeItem =
          hasLogisticaEntregasNotConcluida &&
          hasPaginacaoTrue &&
          isNotBrinde &&
          isNotOffset &&
          isNotConcluido &&
          hasFoValue &&
          hasOrcValue;

        return includeItem;
      });

      console.log("After filtering:", filteredItems.length);

      // BATCH QUERY: Get all operations for all filtered items in ONE query
      const itemIds = filteredItems.map((item) => item.id);

      if (itemIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: allOperations, error: opError } = await supabase
        .from("producao_operacoes")
        .select("item_id, concluido, Tipo_Op")
        .in("item_id", itemIds);

      if (opError) {
        console.error("Error fetching operations:", opError);
      }

      // Group operations by item_id for fast lookup
      const operationsByItem = new Map<string, any[]>();
      if (allOperations) {
        for (const op of allOperations) {
          if (!operationsByItem.has(op.item_id)) {
            operationsByItem.set(op.item_id, []);
          }
          operationsByItem.get(op.item_id)!.push(op);
        }
      }

      // Process items with the batched operations data
      const itemsWithoutCompleted = [];
      for (const item of filteredItems) {
        const itemOps = operationsByItem.get(item.id) || [];
        const corteOps = itemOps.filter((op: any) => op.Tipo_Op === "Corte");

        const hasAnyCorte = corteOps.length > 0;
        const allCorteConcluded =
          hasAnyCorte && corteOps.every((op: any) => op.concluido === true);

        const itemWithStatus = {
          ...item,
          _operationsAllConcluded: allCorteConcluded,
          _hasOperations: itemOps.length > 0,
        };

        // Only exclude when ALL corte operations are concluded
        if (!allCorteConcluded) {
          itemsWithoutCompleted.push(itemWithStatus);
        }
      }

      console.log(
        "Items without completed operations:",
        itemsWithoutCompleted.length,
      );
      setItems(itemsWithoutCompleted);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error occurred";
      setError(`Failed to load production items: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [supabase, foFilter, itemFilter]);

  // Fetch completed items (items with all Corte operations concluded) - last 2 months only
  const fetchCompletedItems = useCallback(async () => {
    setCompletedLoading(true);

    try {
      console.log("Fetching completed items...");

      // Calculate date 2 months ago
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const twoMonthsAgoISO = twoMonthsAgo.toISOString();

      // Fetch items with relations
      let query = supabase.from("items_base").select(`
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade,
          concluido,
          concluido_maq,
          brindes,
          prioridade,
          complexidade,
          created_at,
          folhas_obras!inner (
            Numero_do_,
            numero_orc,
            Trabalho,
            prioridade
          ),
          designer_items (
            paginacao,
            path_trabalho
          ),
          logistica_entregas (
            concluido
          )
        `);

      // Apply database-level filters
      query = query.or("concluido.is.null,concluido.eq.false");

      // Filter to last 2 months
      query = query.gte("created_at", twoMonthsAgoISO);

      if (foFilter?.trim()) {
        query = query.ilike("folhas_obras.Numero_do_", `%${foFilter.trim()}%`);
      }
      if (itemFilter?.trim()) {
        query = query.ilike("descricao", `%${itemFilter.trim()}%`);
      }

      const { data: itemsData, error: itemsError } = await query;

      if (itemsError) {
        console.error("Completed items query failed:", itemsError);
        return;
      }

      if (!itemsData) {
        setCompletedItems([]);
        return;
      }

      // Transform the data
      const transformedItems = itemsData.map((item) => {
        const transformedItem = {
          ...item,
          folhas_obras: Array.isArray(item.folhas_obras)
            ? item.folhas_obras[0]
            : item.folhas_obras,
          designer_items: Array.isArray(item.designer_items)
            ? item.designer_items[0]
            : item.designer_items,
          logistica_entregas: Array.isArray(item.logistica_entregas)
            ? item.logistica_entregas
            : item.logistica_entregas,
        };

        if (transformedItem.folhas_obras) {
          const foData: any = transformedItem.folhas_obras;
          const mappedFo: any = {
            numero_orc: foData.numero_orc,
            prioridade: foData.prioridade,
          };
          if (foData.Numero_do_ !== undefined) {
            mappedFo.numero_fo = String(foData.Numero_do_);
          }
          if (foData.Trabalho !== undefined) {
            mappedFo.nome_campanha = foData.Trabalho;
          }
          transformedItem.folhas_obras = mappedFo;
        }

        return transformedItem;
      });

      // Filter items that meet all conditions
      const filteredItems = transformedItems.filter((item) => {
        let hasLogisticaEntregasNotConcluida = false;

        if (item.logistica_entregas) {
          if (Array.isArray(item.logistica_entregas)) {
            hasLogisticaEntregasNotConcluida = (
              item.logistica_entregas as any[]
            ).some((entrega: any) => entrega.concluido === false);
          } else {
            hasLogisticaEntregasNotConcluida =
              (item.logistica_entregas as any).concluido === false;
          }
        }

        const hasPaginacaoTrue = item.designer_items?.paginacao === true;
        const isNotBrinde = item.brindes !== true;
        const isNotOffset = item.complexidade !== "OFFSET";
        const isNotConcluido = item.concluido !== true;

        const foData = item.folhas_obras as any;
        const hasFoValue =
          foData?.numero_fo &&
          foData?.numero_fo !== "0" &&
          foData?.numero_fo !== "0000";
        const hasOrcValue = foData?.numero_orc && foData?.numero_orc !== 0;

        return (
          hasLogisticaEntregasNotConcluida &&
          hasPaginacaoTrue &&
          isNotBrinde &&
          isNotOffset &&
          isNotConcluido &&
          hasFoValue &&
          hasOrcValue
        );
      });

      // BATCH QUERY: Get all Corte operations for all filtered items in ONE query
      const itemIds = filteredItems.map((item) => item.id);

      if (itemIds.length === 0) {
        setCompletedItems([]);
        return;
      }

      const { data: allCorteOperations, error: opError } = await supabase
        .from("producao_operacoes")
        .select("item_id, concluido, Tipo_Op")
        .in("item_id", itemIds)
        .in("Tipo_Op", ["Corte"]);

      if (opError) {
        console.error("Error fetching corte operations:", opError);
      }

      // Group Corte operations by item_id for fast lookup
      const corteOpsByItem = new Map<string, any[]>();
      if (allCorteOperations) {
        for (const op of allCorteOperations) {
          if (!corteOpsByItem.has(op.item_id)) {
            corteOpsByItem.set(op.item_id, []);
          }
          corteOpsByItem.get(op.item_id)!.push(op);
        }
      }

      // Filter to get ONLY items with ALL Corte operations completed
      const completedItemsList = [];
      for (const item of filteredItems) {
        const corteOps = corteOpsByItem.get(item.id) || [];

        const hasAnyCorte = corteOps.length > 0;
        const allCorteConcluded =
          hasAnyCorte && corteOps.every((op: any) => op.concluido === true);

        // Only include items where ALL corte operations are concluded
        if (allCorteConcluded) {
          completedItemsList.push({
            ...item,
            _operationsAllConcluded: true,
            _hasOperations: true,
          });
        }
      }

      console.log("Completed items found:", completedItemsList.length);
      setCompletedItems(completedItemsList);
    } catch (error: any) {
      console.error("Error fetching completed items:", error);
    } finally {
      setCompletedLoading(false);
    }
  }, [supabase, foFilter, itemFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = items.length;
    const concluidos = completedItems.length;
    const logs = auditLogs.length;

    return {
      total,
      concluidos,
      logs,
    };
  }, [items, completedItems, auditLogs]);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLogsLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching audit logs...");
      const enhancedLogs = await fetchEnhancedAuditLogs(supabase);
      console.log("✅ Enhanced audit logs fetched:", enhancedLogs.length);
      setAuditLogs(enhancedLogs);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error occurred";
      setError(`Failed to load audit logs: ${errorMessage}`);
    } finally {
      setLogsLoading(false);
    }
  }, [supabase]);

  // Filtered & enhanced audit logs
  const { filteredLogs, enhancedStats } = useMemo(() => {
    let filtered = [...auditLogs];

    // Apply filters
    if (logDateFrom) {
      filtered = filtered.filter(
        (log) => log.changed_at && new Date(log.changed_at) >= logDateFrom,
      );
    }
    if (logDateTo) {
      const endOfDay = new Date(logDateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (log) => log.changed_at && new Date(log.changed_at) <= endOfDay,
      );
    }
    if (logOperatorFilter) {
      filtered = filtered.filter(
        (log) =>
          log.operador_antigo_nome?.includes(logOperatorFilter) ||
          log.operador_novo_nome?.includes(logOperatorFilter),
      );
    }
    if (logOpTypeFilter) {
      filtered = filtered.filter(
        (log) => log.producao_operacoes?.Tipo_Op === logOpTypeFilter,
      );
    }
    if (logActionTypeFilter) {
      filtered = filtered.filter(
        (log) => log.action_type === logActionTypeFilter,
      );
    }
    if (logChangedByFilter) {
      filtered = filtered.filter((log) => {
        const changedBy = log.profiles
          ? `${log.profiles.first_name} ${log.profiles.last_name}`
          : "Sistema";
        return changedBy.includes(logChangedByFilter);
      });
    }

    // Calculate enhanced stats
    const suspicious = filtered.filter((log) => {
      // Suspicious if changed_by differs from operation's operador_id
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by !== log.producao_operacoes.operador_id;
    }).length;

    const quantityIncreases = filtered.filter((log) => {
      if (log.quantidade_antiga === null || log.quantidade_nova === null)
        return false;
      const increase =
        ((log.quantidade_nova - log.quantidade_antiga) /
          log.quantidade_antiga) *
        100;
      return increase >= 30; // 30% threshold
    }).length;

    const selfEdits = filtered.filter((log) => {
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by === log.producao_operacoes.operador_id;
    }).length;

    const otherEdits = filtered.filter((log) => {
      if (!log.changed_by || !log.producao_operacoes?.operador_id) return false;
      return log.changed_by !== log.producao_operacoes.operador_id;
    }).length;

    return {
      filteredLogs: filtered,
      enhancedStats: {
        total: filtered.length,
        inserts: filtered.filter((log: any) => log.action_type === "INSERT")
          .length,
        updates: filtered.filter((log: any) => log.action_type === "UPDATE")
          .length,
        deletes: filtered.filter((log: any) => log.action_type === "DELETE")
          .length,
        suspicious,
        quantityIncreases,
        selfEdits,
        otherEdits,
      },
    };
  }, [
    auditLogs,
    logDateFrom,
    logDateTo,
    logOperatorFilter,
    logOpTypeFilter,
    logActionTypeFilter,
    logChangedByFilter,
  ]);

  // Toggle ALL operations completion for an item
  const handleItemCompletion = async (
    itemId: string,
    currentValue: boolean,
  ) => {
    try {
      const newValue = !currentValue;
      const today = new Date().toISOString().split("T")[0];

      // Update ONLY cutting operations for this item
      const { error } = await supabase
        .from("producao_operacoes")
        .update({
          concluido: newValue,
          data_conclusao: newValue ? today : null,
        })
        .eq("item_id", itemId)
        .eq("Tipo_Op", "Corte");

      if (error) throw error;

      // Refresh both lists to update the UI
      fetchData();
      fetchCompletedItems();
    } catch (err) {
      console.error("Error updating operations completion:", err);
      alert("Erro ao atualizar conclusão das operações");
    }
  };

  // Filter items - now filters are applied at database level, so just return items
  // Keeping this for backwards compatibility but filters are applied in fetchData
  const filteredItems = useMemo(() => {
    return items;
  }, [items]);

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortCol) {
        case "numero_fo":
          aVal = a.folhas_obras?.numero_fo || "";
          bVal = b.folhas_obras?.numero_fo || "";
          break;
        case "nome_campanha":
          aVal = a.folhas_obras?.nome_campanha || "";
          bVal = b.folhas_obras?.nome_campanha || "";
          break;
        case "descricao":
          aVal = a.descricao || "";
          bVal = b.descricao || "";
          break;
        case "quantidade":
          aVal = a.quantidade || 0;
          bVal = b.quantidade || 0;
          break;
        case "prioridade":
          // Priority is set on Job level (folhas_obras), not item level
          aVal = a.folhas_obras?.prioridade || false;
          bVal = b.folhas_obras?.prioridade || false;
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }

      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
    });

    return sorted;
  }, [filteredItems, sortCol, sortDir]);

  // Error state - show error with retry option
  if (error && items.length === 0) {
    return (
      <div className="w-full space-y-6 p-6">
        <h1 className="text-2xl uppercase">Operações de Produção</h1>
        <div className="imx-border bg-destructive/10 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg uppercase text-destructive">
                  Erro ao carregar dados
                </h3>
                <p className="mt-1 text-destructive">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="imx-page-stack p-6">
      <h1 className="text-2xl font-bold">Operações de Produção</h1>

      {/* Statistics */}
      <div className="flex gap-4 text-sm">
        <span>Total: {stats.total}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Filtrar FO"
          className="h-10 w-40 min-w-[160px]"
          value={foFilter}
          onChange={(e) => setFoFilter(e.target.value)}
        />
        <Input
          placeholder="Filtrar Item"
          className="h-10 flex-1 min-w-[200px]"
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            setFoFilter("");
            setItemFilter("");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={fetchData}
          title="Refresh data"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tabs for Operations, Analytics, and Logs */}
      <Tabs
        defaultValue="operacoes"
        className="w-full"
        onValueChange={async (value) => {
          setCurrentTab(value);
          if (value === "concluidos" && completedItems.length === 0) {
            // Fetch completed items when switching to concluidos tab for the first time
            await fetchCompletedItems();
          }
          if (value === "logs" && auditLogs.length === 0) {
            // Fetch audit logs when switching to logs tab for the first time
            await fetchAuditLogs();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operacoes">Operações ({stats.total})</TabsTrigger>
          <TabsTrigger value="concluidos">
            Concluídos ({stats.concluidos})
          </TabsTrigger>
          <TabsTrigger value="logs">Logs ({stats.logs})</TabsTrigger>
        </TabsList>

        <TabsContent value="operacoes">
          {/* Main table */}
          <div className="imx-table-wrap">
            <div className="w-full overflow-x-auto">
              <Table className="w-full imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      onClick={() => toggleSort("numero_fo")}
                      className="sticky top-0 z-10 w-[120px] cursor-pointer imx-border-b uppercase select-none"
                    >
                      FO{" "}
                      {sortCol === "numero_fo" &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="ml-1 inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 inline h-3 w-3" />
                        ))}
                    </TableHead>
                    <TableHead
                      onClick={() => toggleSort("nome_campanha")}
                      className="sticky top-0 z-10 cursor-pointer imx-border-b uppercase select-none"
                    >
                      Campanha{" "}
                      {sortCol === "nome_campanha" &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="ml-1 inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 inline h-3 w-3" />
                        ))}
                    </TableHead>
                    <TableHead
                      onClick={() => toggleSort("descricao")}
                      className="sticky top-0 z-10 cursor-pointer imx-border-b uppercase select-none"
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
                      onClick={() => toggleSort("quantidade")}
                      className="sticky top-0 z-10 w-[100px] cursor-pointer imx-border-b text-right uppercase select-none"
                    >
                      Quantidade{" "}
                      {sortCol === "quantidade" &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="ml-1 inline h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 inline h-3 w-3" />
                        ))}
                    </TableHead>
                    <TableHead
                      onClick={() => toggleSort("prioridade")}
                      className="sticky top-0 z-10 w-[36px] min-w-[36px] cursor-pointer imx-border-b uppercase select-none"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              P{" "}
                              {sortCol === "prioridade" &&
                                (sortDir === "asc" ? (
                                  <ArrowUp className="ml-1 inline h-3 w-3" />
                                ) : (
                                  <ArrowDown className="ml-1 inline h-3 w-3" />
                                ))}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Prioridade</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="w-[60px] imx-border-b text-center uppercase">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">C</span>
                          </TooltipTrigger>
                          <TooltipContent>Concluído</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="w-[50px] imx-border-b text-center uppercase"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id} className="imx-row-hover">
                      <TableCell className="w-[120px]">
                        {item.folhas_obras?.numero_fo}
                      </TableCell>
                      <TableCell>{item.folhas_obras?.nome_campanha}</TableCell>
                      <TableCell>{item.descricao}</TableCell>
                      <TableCell className="w-[100px] text-right">
                        {item.quantidade}
                      </TableCell>
                      <TableCell className="w-[36px] min-w-[36px] text-center">
                        <div
                          className={`mx-auto flex h-3 w-3 items-center justify-center ${getPColor(item)}`}
                          title={item.prioridade ? "Prioritário" : "Normal"}
                        />
                      </TableCell>
                      <TableCell className="w-[60px]">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={
                              (item as any)._operationsAllConcluded || false
                            }
                            onCheckedChange={() =>
                              handleItemCompletion(
                                item.id,
                                (item as any)._operationsAllConcluded || false,
                              )
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-[50px]">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setDrawerOpen(true);
                            }}
                            title="Ver operações"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        Nenhum item encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="concluidos">
          {/* Completed items table - mirror of operacoes table but with completed items */}
          <div className="imx-table-wrap">
            <div className="w-full overflow-x-auto">
              {completedLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">A carregar itens concluídos...</span>
                </div>
              ) : (
                <Table className="w-full imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        onClick={() => toggleSort("numero_fo")}
                        className="sticky top-0 z-10 w-[120px] cursor-pointer imx-border-b uppercase select-none"
                      >
                        FO{" "}
                        {sortCol === "numero_fo" &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("nome_campanha")}
                        className="sticky top-0 z-10 cursor-pointer imx-border-b uppercase select-none"
                      >
                        Campanha{" "}
                        {sortCol === "nome_campanha" &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("descricao")}
                        className="sticky top-0 z-10 cursor-pointer imx-border-b uppercase select-none"
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
                        onClick={() => toggleSort("quantidade")}
                        className="sticky top-0 z-10 w-[100px] cursor-pointer imx-border-b text-right uppercase select-none"
                      >
                        Quantidade{" "}
                        {sortCol === "quantidade" &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("prioridade")}
                        className="sticky top-0 z-10 w-[36px] min-w-[36px] cursor-pointer imx-border-b uppercase select-none"
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                P{" "}
                                {sortCol === "prioridade" &&
                                  (sortDir === "asc" ? (
                                    <ArrowUp className="ml-1 inline h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="ml-1 inline h-3 w-3" />
                                  ))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Prioridade</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="w-[60px] imx-border-b text-center uppercase">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">C</span>
                            </TooltipTrigger>
                            <TooltipContent>Concluído</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="w-[50px] imx-border-b text-center uppercase"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedItems.map((item) => (
                      <TableRow key={item.id} className="imx-row-hover">
                        <TableCell className="w-[120px]">
                          {item.folhas_obras?.numero_fo}
                        </TableCell>
                        <TableCell>
                          {item.folhas_obras?.nome_campanha}
                        </TableCell>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell className="w-[100px] text-right">
                          {item.quantidade}
                        </TableCell>
                        <TableCell className="w-[36px] min-w-[36px] text-center">
                          <div
                            className={`mx-auto flex h-3 w-3 items-center justify-center ${getPColor(item)}`}
                            title={item.prioridade ? "Prioritário" : "Normal"}
                          />
                        </TableCell>
                        <TableCell className="w-[60px]">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={
                                (item as any)._operationsAllConcluded || false
                              }
                              onCheckedChange={() =>
                                handleItemCompletion(
                                  item.id,
                                  (item as any)._operationsAllConcluded ||
                                    false,
                                )
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-[50px]">
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedItemId(item.id);
                                setDrawerOpen(true);
                              }}
                              title="Ver operações"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {completedItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center">
                          Nenhum item concluído encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          {/* Audit logs controls */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg uppercase">Logs de Auditoria</h3>
            <Button
              size="icon"
              variant="outline"
              onClick={fetchAuditLogs}
              title="Atualizar logs"
              disabled={logsLoading}
            >
              {logsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Data De
              </label>
              <input
                type="date"
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={
                  logDateFrom ? logDateFrom.toISOString().split("T")[0] : ""
                }
                onChange={(e) =>
                  setLogDateFrom(
                    e.target.value ? new Date(e.target.value) : undefined,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Data Até
              </label>
              <input
                type="date"
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={logDateTo ? logDateTo.toISOString().split("T")[0] : ""}
                onChange={(e) =>
                  setLogDateTo(
                    e.target.value ? new Date(e.target.value) : undefined,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Operador
              </label>
              <input
                type="text"
                placeholder="Filtrar..."
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={logOperatorFilter}
                onChange={(e) => setLogOperatorFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Tipo Op
              </label>
              <select
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={logOpTypeFilter}
                onChange={(e) => setLogOpTypeFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="Impressao">Impressão</option>
                <option value="Corte">Corte</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Ação
              </label>
              <select
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={logActionTypeFilter}
                onChange={(e) => setLogActionTypeFilter(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="INSERT">Criado</option>
                <option value="UPDATE">Alterado</option>
                <option value="DELETE">Eliminado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted-foreground">
                Alterado Por
              </label>
              <input
                type="text"
                placeholder="Filtrar..."
                className="h-9 w-full rounded-md imx-border  bg-background px-3 text-sm"
                value={logChangedByFilter}
                onChange={(e) => setLogChangedByFilter(e.target.value)}
              />
            </div>
          </div>
          {(logDateFrom ||
            logDateTo ||
            logOperatorFilter ||
            logOpTypeFilter ||
            logActionTypeFilter ||
            logChangedByFilter) && (
            <div className="mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLogDateFrom(undefined);
                  setLogDateTo(undefined);
                  setLogOperatorFilter("");
                  setLogOpTypeFilter("");
                  setLogActionTypeFilter("");
                  setLogChangedByFilter("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          )}

          {/* Audit logs table */}
          <div className="imx-table-wrap">
            <div className="w-full overflow-x-auto">
              {logsLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">A carregar logs de auditoria...</span>
                </div>
              ) : (
                <Table className="w-full imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 w-[120px] imx-border-b uppercase">
                        Ação
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[150px] imx-border-b uppercase">
                        Operação
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[120px] imx-border-b uppercase">
                        Campo
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[150px] imx-border-b uppercase">
                        Operador Antigo
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[150px] imx-border-b uppercase">
                        Operador Novo
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[100px] imx-border-b uppercase">
                        Qtd Antiga
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[100px] imx-border-b uppercase">
                        Qtd Nova
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[120px] imx-border-b uppercase">
                        Valor Antigo
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[120px] imx-border-b uppercase">
                        Valor Novo
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[120px] imx-border-b uppercase">
                        Alterado Por
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[160px] imx-border-b uppercase">
                        Data/Hora
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log: any) => {
                      // Check for suspicious activity
                      const isSuspicious =
                        log.changed_by &&
                        log.producao_operacoes?.operador_id &&
                        log.changed_by !== log.producao_operacoes.operador_id;

                      // Check for significant quantity increase
                      const hasQuantityIncrease =
                        log.quantidade_antiga !== null &&
                        log.quantidade_nova !== null &&
                        ((log.quantidade_nova - log.quantidade_antiga) /
                          log.quantidade_antiga) *
                          100 >=
                          30;

                      return (
                        <TableRow
                          key={log.id}
                          className={`hover:bg-accent ${isSuspicious ? "bg-warning/15 dark:bg-warning/30" : ""}`}
                        >
                          {/* Action Type */}
                          <TableCell className="w-[120px]">
                            <Badge
                              variant={
                                log.action_type === "INSERT"
                                  ? "default"
                                  : log.action_type === "DELETE"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {log.action_type === "INSERT" && "CRIADO"}
                              {log.action_type === "UPDATE" && "ALTERADO"}
                              {log.action_type === "DELETE" && "ELIMINADO"}
                            </Badge>
                          </TableCell>

                          {/* Operation Info */}
                          <TableCell className="w-[150px] font-mono text-sm">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate">
                                    {log.producao_operacoes?.no_interno ||
                                      "N/A"}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <div>ID: {log.operacao_id}</div>
                                    {log.producao_operacoes?.items_base && (
                                      <div>
                                        Item:{" "}
                                        {
                                          log.producao_operacoes.items_base
                                            .descricao
                                        }
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          {/* Field Name */}
                          <TableCell className="w-[120px]">
                            {log.field_name ? (
                              (() => {
                                const fieldNameMap: { [key: string]: string } =
                                  {
                                    operador_id: "Operador",
                                    num_placas_print: "Placas Impressão",
                                    num_placas_corte: "Placas Corte",
                                    material_id: "Material",
                                    maquina: "Máquina",
                                    data_operacao: "Data",
                                    notas: "Notas",
                                    notas_imp: "Notas Impressão",
                                    N_Pal: "Palete",
                                    QT_print: "QT Print",
                                    concluido: "Concluído",
                                    created: "Criação",
                                    deleted: "Eliminação",
                                  };
                                return (
                                  fieldNameMap[log.field_name] || log.field_name
                                );
                              })()
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Operador Antigo */}
                          <TableCell className="w-[150px]">
                            {log.operador_antigo_nome ? (
                              <span
                                className="block truncate"
                                title={log.operador_antigo_nome}
                              >
                                {log.operador_antigo_nome}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Operador Novo */}
                          <TableCell className="w-[150px]">
                            {log.operador_novo_nome ? (
                              <span
                                className="block truncate"
                                title={log.operador_novo_nome}
                              >
                                {log.operador_novo_nome}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Quantidade Antiga */}
                          <TableCell className="w-[100px] text-right">
                            {log.quantidade_antiga !== null &&
                            log.quantidade_antiga !== undefined
                              ? log.quantidade_antiga
                              : "-"}
                          </TableCell>

                          {/* Quantidade Nova */}
                          <TableCell className="w-[100px] text-right">
                            <div className="flex items-center justify-end gap-1">
                              {log.quantidade_nova !== null &&
                              log.quantidade_nova !== undefined
                                ? log.quantidade_nova
                                : "-"}
                              {hasQuantityIncrease && (
                                <Badge
                                  variant="destructive"
                                  className="ml-1 text-xs"
                                >
                                  +
                                  {Math.round(
                                    ((log.quantidade_nova -
                                      log.quantidade_antiga) /
                                      log.quantidade_antiga) *
                                      100,
                                  )}
                                  %
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Valor Antigo */}
                          <TableCell className="w-[120px]">
                            <span
                              className="block truncate"
                              title={log.old_value_display || log.old_value}
                            >
                              {log.old_value_display || log.old_value || "-"}
                            </span>
                          </TableCell>

                          {/* Valor Novo */}
                          <TableCell className="w-[120px]">
                            <span
                              className="block truncate"
                              title={log.new_value_display || log.new_value}
                            >
                              {log.new_value_display || log.new_value || "-"}
                            </span>
                          </TableCell>

                          {/* Changed By */}
                          <TableCell className="w-[120px]">
                            {log.profiles
                              ? `${log.profiles.first_name} ${log.profiles.last_name}`
                              : "Sistema"}
                          </TableCell>

                          {/* Changed At */}
                          <TableCell className="w-[160px]">
                            {log.changed_at
                              ? format(
                                  new Date(log.changed_at),
                                  "dd/MM/yyyy HH:mm:ss",
                                  { locale: pt },
                                )
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center">
                          Nenhum log de auditoria encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">Total</h4>
              <p className="text-2xl font-bold">{enhancedStats.total}</p>
            </Card>
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">
                Criadas
              </h4>
              <p className="text-2xl font-bold text-success">
                {enhancedStats.inserts}
              </p>
            </Card>
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">
                Alteradas
              </h4>
              <p className="text-2xl font-bold text-info">
                {enhancedStats.updates}
              </p>
            </Card>
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">
                Eliminadas
              </h4>
              <p className="text-2xl font-bold text-destructive">
                {enhancedStats.deletes}
              </p>
            </Card>
            <Card className="imx-border p-4 bg-warning/15 dark:bg-warning/30">
              <h4 className="text-xs uppercase text-muted-foreground">
                Suspeitas
              </h4>
              <p className="text-2xl font-bold text-warning">
                {enhancedStats.suspicious}
              </p>
            </Card>
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">
                Auto-Edição
              </h4>
              <p className="text-2xl font-bold">{enhancedStats.selfEdits}</p>
            </Card>
            <Card className="imx-border p-4">
              <h4 className="text-xs uppercase text-muted-foreground">
                Aumentos 30%+
              </h4>
              <p className="text-2xl font-bold text-orange-600">
                {enhancedStats.quantityIncreases}
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Production Operations Drawer */}
      <ProductionOperationsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        itemId={selectedItemId}
        supabase={supabase}
        onRefresh={fetchData}
      />
    </div>
  );
}
