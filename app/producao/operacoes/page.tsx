"use client";

/**
 * Production Operations Page
 * -------------------------
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

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Combobox from "@/components/ui/Combobox";
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createBrowserClient } from "@/utils/supabase";
import DatePicker from "@/components/custom/DatePicker";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";
// PERFORMANCE: Recharts is lazy loaded (300KB) - only loads when charts tab is viewed
import dynamic from "next/dynamic";
const ProductionAnalyticsCharts = dynamic(
  () => import("@/components/ProductionAnalyticsCharts"),
  {
    loading: () => (
      <div className="p-8 text-center text-muted-foreground">
        Loading charts...
      </div>
    ),
    ssr: false,
  },
);
import { useTableData } from "@/hooks/useTableData";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
  fetchEnhancedAuditLogs,
  resolveOperatorName,
} from "@/utils/auditLogging";
import { CorteLoosePlatesTable } from "./components/CorteLoosePlatesTable";
import {
  duplicateOperationRow,
  autoSaveField,
  validateOperationQuantity,
  calculatePrintJobProgress,
  calculateCutFromPrintProgress,
  calculateCutJobProgress,
} from "./utils/operationsHelpers";
import {
  OperationProgress,
  InlineProgress,
} from "./components/OperationProgress";
import {
  Plus,
  X,
  RotateCw,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Settings,
  RefreshCcw,
  Trash2,
  Copy,
  Edit3,
  Check,
  XSquare,
} from "lucide-react";

// Types
interface ProductionItem {
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
  data_in?: string | null; // Date when work order was entered - for priority calculation
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
}

interface ProductionOperation {
  id: string;
  data_operacao: string;
  operador_id?: string | null;
  folha_obra_id: string;
  item_id: string;
  no_interno: string;
  Tipo_Op?: string;
  maquina?: string | null;
  material_id?: string | null;
  stock_consumido_id?: string | null;
  num_placas_print?: number | null;
  num_placas_corte?: number | null;
  QT_print?: number | null;
  observacoes?: string | null;
  notas?: string | null;
  notas_imp?: string | null;
  status?: string;
  concluido?: boolean;
  data_conclusao?: string | null;
  created_at?: string;
  updated_at?: string;
  N_Pal?: string | null;
  tem_corte?: boolean | null;
  source_impressao_id?: string | null; // Links Corte operations to source Impressão operation
  plano_nome?: string | null; // Plan name (e.g., "Plano A", "Plano B")
  cores?: string | null; // Print colors (e.g., "4/4", "4/0")
  qt_print_planned?: number | null; // Planned print quantity from designer
  qt_corte_planned?: number | null; // Planned cut quantity
  print_job_id?: string | null; // Groups all print splits together
  cut_job_id?: string | null; // Groups all cut splits together
  is_source_record?: boolean; // TRUE for planning rows
  parent_operation_id?: string | null; // References source operation for duplicates
  batch_id?: string | null; // Groups related split operations
  batch_parent_id?: string | null; // References original operation if this is a duplicate
  total_placas?: number | null; // Total plates across all batches
  placas_neste_batch?: number | null; // Plates assigned to this batch/session
}

type SortKey =
  | "numero_fo"
  | "nome_campanha"
  | "descricao"
  | "quantidade"
  | "prioridade";

export default function OperacoesPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  // State
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

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

      // Filter out items that have completed operations (Corte) AND attach operations status
      const itemsWithoutCompleted = [];
      for (const item of filteredItems) {
        // First, get ALL operations for this item to check completion status
        const { data: allOperations, error: allOpError } = await supabase
          .from("producao_operacoes")
          .select("concluido, Tipo_Op")
          .eq("item_id", item.id);

        // Then, get only Corte operations to check if item should be filtered out
        const { data: corteOperations, error: corteOpError } = await supabase
          .from("producao_operacoes")
          .select("concluido")
          .eq("item_id", item.id)
          .in("Tipo_Op", ["Corte"]);

        if (!allOpError && allOperations) {
          // Check if item has completed Corte operations (for filtering)
          const hasCompletedCorte =
            corteOperations &&
            corteOperations.some((op: any) => op.concluido === true);

          // Attach operations completion status based on ALL operations
          const allOperationsConcluded =
            allOperations.length > 0 &&
            allOperations.every((op: any) => op.concluido === true);
          const itemWithStatus = {
            ...item,
            _operationsAllConcluded: allOperationsConcluded,
            _hasOperations: allOperations.length > 0,
          };

          // Only include items that don't have completed Corte operations
          if (!hasCompletedCorte) {
            itemsWithoutCompleted.push(itemWithStatus);
          }
        } else {
          // If no operations exist, include the item
          itemsWithoutCompleted.push({
            ...item,
            _operationsAllConcluded: false,
            _hasOperations: false,
          });
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

  // Debug function
  const runDebugCheck = useCallback(async () => {
    console.log("Running debug check...");
    const debug: any = {};

    try {
      const tables = [
        "items_base",
        "folhas_obras",
        "designer_items",
        "logistica_entregas",
      ];

      for (const table of tables) {
        try {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          if (error) {
            debug[table] = { error: error.message, accessible: false };
          } else {
            debug[table] = { accessible: true, count: count || 0 };
          }
        } catch (err: any) {
          debug[table] = { error: err.message, accessible: false };
        }
      }

      // Check authentication
      const {
        data: { user },
      } = await supabase.auth.getUser();
      debug.authenticated = !!user;
      debug.user_id = user?.id || "Not authenticated";

      setDebugInfo(debug);
      setShowDebug(true);
    } catch (err: any) {
      console.error("Debug check failed:", err);
      setDebugInfo({ general_error: err.message });
      setShowDebug(true);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = items.length;
    const logs = auditLogs.length;

    return {
      total,
      logs,
    };
  }, [items, auditLogs]);

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

      // Update ALL operations for this item
      const { error } = await supabase
        .from("producao_operacoes")
        .update({
          concluido: newValue,
          data_conclusao: newValue ? today : null,
        })
        .eq("item_id", itemId);

      if (error) throw error;

      // Refresh data to update the UI
      fetchData();
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

  if (loading && items.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            A carregar items de produção...
          </p>
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl uppercase">Operações de Produção</h1>
        <div className="imx-border  bg-destructive/10 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg uppercase text-destructive">
                  Erro ao carregar dados
                </h3>
                <p className="mt-1 text-destructive">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RotateCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={runDebugCheck}>
              <Settings className="mr-2 h-4 w-4" />
              Diagnóstico
            </Button>
            {showDebug && debugInfo && (
              <div className="mt-4 imx-border  bg-muted p-4">
                <h4 className="mb-2 uppercase text-foreground">
                  Informação de Diagnóstico:
                </h4>
                <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDebug(false)}
                  className="mt-2"
                >
                  Fechar Diagnóstico
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0 && !error) {
    return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl uppercase">Operações de Produção</h1>
        <div className="flex gap-4 text-sm">
          <span>Total: 0</span>
        </div>
        <div className="imx-border  bg-muted p-6">
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg uppercase text-foreground">
                Nenhum item pronto para produção
              </h3>
              <p className="mt-2 text-muted-foreground">
                Não foram encontrados itens que atendam aos critérios
                necessários.
              </p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Para um item aparecer aqui, deve ter:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>FO e ORC preenchidos</strong> (numero_fo e numero_orc
                  válidos)
                </li>
                <li>
                  <strong>Paginação concluída</strong> (designer_items.paginacao
                  = true)
                </li>
                <li>
                  <strong>Entregas não concluídas</strong>{" "}
                  (logistica_entregas.concluido = false)
                </li>
                <li>
                  <strong>Não ser brinde</strong> (brindes &ne; true)
                </li>
                <li>
                  <strong>Complexidade não ser OFFSET</strong> (complexidade
                  &ne; &apos;OFFSET&apos;)
                </li>
              </ul>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Atualizar Lista
              </Button>
              <Button variant="outline" onClick={runDebugCheck}>
                <Settings className="mr-2 h-4 w-4" />
                Diagnóstico
              </Button>
            </div>
          </div>
        </div>
        {showDebug && debugInfo && (
          <div className="mt-4 imx-border  bg-muted p-4">
            <h4 className="mb-2 font-semibold text-foreground">
              Informação de Diagnóstico:
            </h4>
            <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(false)}
              className="mt-2"
            >
              Fechar Diagnóstico
            </Button>
          </div>
        )}
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
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filtrar FO"
          className="h-10 w-40"
          value={foFilter}
          onChange={(e) => setFoFilter(e.target.value)}
        />
        <Input
          placeholder="Filtrar Item"
          className="h-10 flex-1"
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
          if (value === "logs" && auditLogs.length === 0) {
            // Fetch audit logs when switching to logs tab for the first time
            await fetchAuditLogs();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operacoes">Operações ({stats.total})</TabsTrigger>
          <TabsTrigger value="analytics">Análises & Gráficos</TabsTrigger>
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
                    <TableHead className="w-[100px] imx-border-b p-2 text-sm uppercase">
                      Ações
                    </TableHead>
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
                      <TableCell className="w-[100px]">
                        <Button
                          size="icon"
                          variant="default"
                          onClick={() => setOpenItemId(item.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

        <TabsContent value="analytics" className="mb-8">
          <ProductionAnalyticsCharts
            supabase={supabase}
            onRefresh={fetchData}
          />
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

      {/* Drawer - Will add operations management here */}
      <Drawer
        open={!!openItemId}
        onOpenChange={(open) => !open && setOpenItemId(null)}
        shouldScaleBackground={false}
      >
        <DrawerContent className="!top-0 h-screen max-h-none min-h-0 !transform-none overflow-y-auto">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Operações de Produção</DrawerTitle>
            <DrawerDescription>
              Gestão de operações de impressão e corte
            </DrawerDescription>
          </DrawerHeader>
          {openItemId && (
            <ItemDrawerContent
              itemId={openItemId}
              items={items}
              onClose={() => setOpenItemId(null)}
              supabase={supabase}
              onMainRefresh={fetchData}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Drawer content component
interface ItemDrawerProps {
  itemId: string;
  items: ProductionItem[];
  onClose: () => void;
  supabase: any;
  onMainRefresh: () => void;
}

function ItemDrawerContent({
  itemId,
  items,
  onClose,
  supabase,
  onMainRefresh,
}: ItemDrawerProps) {
  const item = items.find((i) => i.id === itemId);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [designerPlanos, setDesignerPlanos] = useState<any[]>([]);
  const [importingPlanos, setImportingPlanos] = useState(false);

  /**
   * Calculate stock quantity to deduct from paletes
   * Rounds UP fractional plates to whole numbers
   * Example: 20.5 plates → 21 plates deducted from stock
   */
  const calculateStockDeduction = (
    plates: number | null | undefined,
  ): number => {
    if (!plates) return 0;
    return Math.ceil(plates);
  };

  const fetchOperations = useCallback(async () => {
    if (!item) return;

    setLoading(true);
    try {
      const { data: operationsData, error } = await supabase
        .from("producao_operacoes")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching operations:", error);
      } else {
        setOperations(operationsData || []);
      }
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setLoading(false);
    }
  }, [item, supabase]);

  const fetchDesignerPlanos = useCallback(async () => {
    if (!item) return;

    try {
      const { data, error } = await supabase
        .from("designer_planos")
        .select("*")
        .eq("item_id", item.id)
        .eq("criado_em_producao", false)
        .order("plano_ordem", { ascending: true });

      if (!error && data) {
        setDesignerPlanos(data);
      }
    } catch (error) {
      console.error("Error fetching designer planos:", error);
    }
  }, [item, supabase]);

  useEffect(() => {
    fetchOperations();
    fetchDesignerPlanos();
  }, [fetchOperations, fetchDesignerPlanos]);

  const handleImportPlanos = async () => {
    if (!item || designerPlanos.length === 0) return;

    setImportingPlanos(true);
    try {
      let importedCount = 0;

      // Fetch all machines to map names to IDs (for legacy planos with machine names)
      const { data: machinesData, error: machinesError } = await supabase
        .from("maquinas_operacao")
        .select("id, nome_maquina");

      const machineNameToId = new Map<string, string>();
      if (machinesData) {
        machinesData.forEach((m: any) => {
          machineNameToId.set(m.nome_maquina.toUpperCase(), m.id);
        });
      }

      for (const plano of designerPlanos) {
        const now = new Date();
        const dateStr = format(now, "yyyyMMdd");
        const timeStr = format(now, "HHmmss");
        const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
        const typePrefix =
          plano.tipo_operacao === "Impressao"
            ? "IMP"
            : plano.tipo_operacao === "Impressao_Flexiveis"
              ? "FLX"
              : "CRT";
        const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}-${plano.plano_ordem}`;

        // Handle legacy planos: if maquina is not a UUID, look up by name
        let maquinaId = plano.maquina;
        if (
          plano.maquina &&
          !plano.maquina.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          )
        ) {
          // It's a machine name, not a UUID - look it up
          maquinaId = machineNameToId.get(plano.maquina.toUpperCase()) || null;
        }

        const USE_NEW_FIELDS = true;

        const baseData = {
          item_id: itemId,
          folha_obra_id: item.folha_obra_id,
          Tipo_Op: plano.tipo_operacao,
          plano_nome: plano.plano_nome,
          material_id: plano.material_id,
          cores: plano.cores,
          data_operacao: new Date().toISOString().split("T")[0],
          no_interno,
          notas_imp: plano.notas,
          QT_print: plano.quantidade,
          concluido: false,
        };

        const printJobId =
          plano.tipo_operacao === "Impressao" ||
          plano.tipo_operacao === "Impressao_Flexiveis"
            ? crypto.randomUUID()
            : null;
        const cutJobId =
          plano.tipo_operacao === "Corte" ? crypto.randomUUID() : null;

        const operationData = USE_NEW_FIELDS
          ? {
              ...baseData,
              is_source_record: true,
              qt_print_planned:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : null,
              qt_corte_planned:
                plano.tipo_operacao === "Corte" ? plano.quantidade : null,
              print_job_id: printJobId,
              cut_job_id: cutJobId,
              num_placas_print:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : 0,
              num_placas_corte:
                plano.tipo_operacao === "Corte" ? plano.quantidade : 0,
              maquina: null,
              operador_id: null,
            }
          : {
              ...baseData,
              num_placas_print:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : 0,
              num_placas_corte:
                plano.tipo_operacao === "Corte" ? plano.quantidade : 0,
              maquina: maquinaId,
            };

        const { data: savedOp, error: opError } = await supabase
          .from("producao_operacoes")
          .insert([operationData])
          .select()
          .single();

        if (opError) {
          console.error(
            "Error inserting operation:",
            JSON.stringify(opError, null, 2),
          );
          console.error(
            "Operation data:",
            JSON.stringify(operationData, null, 2),
          );
        }

        if (!opError && savedOp) {
          // Mark plano as created
          await supabase
            .from("designer_planos")
            .update({
              criado_em_producao: true,
              producao_operacao_id: savedOp.id,
            })
            .eq("id", plano.id);

          // Log operation creation
          await logOperationCreation(supabase, savedOp.id, operationData);

          // If Impressao, create linked Corte (standard behavior)
          if (
            plano.tipo_operacao === "Impressao" ||
            plano.tipo_operacao === "Impressao_Flexiveis"
          ) {
            const corteNoInterno = `${no_interno}-CORTE`;
            const corteData = USE_NEW_FIELDS
              ? {
                  Tipo_Op: "Corte",
                  item_id: itemId,
                  folha_obra_id: item.folha_obra_id,
                  data_operacao: new Date().toISOString().split("T")[0],
                  no_interno: corteNoInterno,
                  source_impressao_id: savedOp.id,
                  material_id: plano.material_id,
                  plano_nome: plano.plano_nome,
                  cores: plano.cores,
                  is_source_record: true,
                  qt_corte_planned: plano.quantidade,
                  cut_job_id: crypto.randomUUID(),
                  num_placas_corte: plano.quantidade,
                  operador_id: null,
                  maquina: null,
                  concluido: false,
                  QT_print: plano.quantidade || 0,
                }
              : {
                  Tipo_Op: "Corte",
                  item_id: itemId,
                  folha_obra_id: item.folha_obra_id,
                  data_operacao: new Date().toISOString().split("T")[0],
                  no_interno: corteNoInterno,
                  num_placas_corte: 0,
                  QT_print: plano.quantidade || 0,
                  source_impressao_id: savedOp.id,
                  material_id: plano.material_id,
                  plano_nome: plano.plano_nome,
                  cores: plano.cores,
                  concluido: false,
                };

            const { data: corteOp, error: corteError } = await supabase
              .from("producao_operacoes")
              .insert([corteData])
              .select()
              .single();

            if (!corteError && corteOp) {
              await logOperationCreation(supabase, corteOp.id, corteData);
            }
          }

          importedCount++;
        }
      }

      if (importedCount > 0) {
        alert(`${importedCount} planos importados com sucesso!`);
        fetchOperations();
        fetchDesignerPlanos();
        onMainRefresh();
      } else {
        alert("Nenhum plano foi importado. Verifique a consola para erros.");
      }
    } catch (error) {
      console.error("Error importing planos:", error);
      alert(`Erro ao importar planos: ${error}`);
    } finally {
      setImportingPlanos(false);
    }
  };

  if (!item) return null;

  const impressaoOperations = operations.filter(
    (op) => op.Tipo_Op === "Impressao",
  );
  const corteOperations = operations.filter((op) => op.Tipo_Op === "Corte");

  return (
    <div className="relative space-y-6 p-6">
      {/* Close button and Quantity */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs uppercase">Quantidade</div>
          <div className="font-mono text-lg">{item.quantidade}</div>
        </div>
        <Button size="icon" variant="outline" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Item info */}
      <div className="mb-6 p-4 uppercase">
        <div className="mb-2 flex items-center gap-8">
          <div>
            <div className="text-xs uppercase">FO</div>
            <div className="font-mono">{item.folhas_obras?.numero_fo}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase">Campanha</div>
            <div className="truncate font-mono">
              {item.folhas_obras?.nome_campanha}
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase">Item</div>
          <div className="font-mono">{item.descricao}</div>
        </div>
      </div>

      {/* Import Planos Button - Show if there are designer planos available */}
      {designerPlanos.length > 0 && (
        <div className="mb-4 rounded-lg imx-border  bg-info/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-info-foreground">
                Planos Disponíveis do Designer
              </h4>
              <p className="text-sm text-info-foreground/80">
                {designerPlanos.length} plano
                {designerPlanos.length > 1 ? "s" : ""} pronto
                {designerPlanos.length > 1 ? "s" : ""} para importar
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {designerPlanos.map((plano: any) => (
                  <Badge
                    key={plano.id}
                    variant="secondary"
                    className="font-mono"
                  >
                    {plano.plano_nome}: {plano.tipo_operacao} -{" "}
                    {plano.quantidade || 0} placas
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={handleImportPlanos}
              disabled={importingPlanos}
              className="bg-info text-info-foreground hover:bg-info/90"
            >
              {importingPlanos ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Importar Planos
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs for different operation types */}
      <Tabs defaultValue="impressao" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impressao">
            Impressão ({impressaoOperations.length})
          </TabsTrigger>
          <TabsTrigger value="corte_impressao">
            Corte de Impressões (
            {corteOperations.filter((op) => op.source_impressao_id).length})
          </TabsTrigger>
          <TabsTrigger value="corte_chapas">
            Operações de Corte (Chapas Soltas) (
            {corteOperations.filter((op) => !op.source_impressao_id).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="impressao">
          <OperationsTable
            operations={impressaoOperations}
            type="Impressao"
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="corte_impressao">
          <CorteFromPrintTable
            operations={corteOperations.filter((op) => op.source_impressao_id)}
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="corte_chapas">
          <CorteLoosePlatesTable
            operations={corteOperations.filter((op) => !op.source_impressao_id)}
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Operations Table Component (Impressão ONLY - Corte has separate components)
interface OperationsTableProps {
  operations: ProductionOperation[];
  type: "Impressao";
  itemId: string;
  folhaObraId: string;
  item: ProductionItem;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}

function OperationsTable({
  operations,
  type,
  itemId,
  folhaObraId,
  item,
  supabase,
  onRefresh,
  onMainRefresh,
}: OperationsTableProps) {
  const { operators, machines } = useTableData();
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    materialsData,
  } = useMaterialsCascading();

  const [materialSelections, setMaterialSelections] = useState<{
    [operationId: string]: {
      material?: string;
      carateristica?: string;
      cor?: string;
    };
  }>({});
  const [paletteSelections, setPaletteSelections] = useState<{
    [operationId: string]: string;
  }>({});
  const [paletes, setPaletes] = useState<any[]>([]);
  const [paletesLoading, setPaletesLoading] = useState(false);

  // INLINE EDITING: No edit mode needed - all fields always editable
  // Progress tracking state
  const [jobProgress, setJobProgress] = useState<Record<string, any>>({});

  // Fetch paletes
  useEffect(() => {
    const fetchPaletes = async () => {
      setPaletesLoading(true);
      try {
        const { data, error } = await supabase
          .from("paletes")
          .select("*")
          .order("no_palete", { ascending: false });

        if (!error && data) {
          setPaletes(data);
        }
      } catch (err) {
        console.error("Error fetching paletes:", err);
      } finally {
        setPaletesLoading(false);
      }
    };

    fetchPaletes();
  }, [supabase]);

  // Check if material is from palette
  const isMaterialFromPalette = (operationId: string) => {
    return !!paletteSelections[operationId];
  };

  // Initialize material and palette selections from existing operations
  useEffect(() => {
    const initSelections = () => {
      const newMaterialSelections: {
        [operationId: string]: {
          material?: string;
          carateristica?: string;
          cor?: string;
        };
      } = {};
      const newPaletteSelections: { [operationId: string]: string } = {};

      operations.forEach((op) => {
        // Initialize palette selections from N_Pal field
        if (op.N_Pal && paletes.length > 0) {
          const palette = paletes.find((p) => p.no_palete === op.N_Pal);

          if (palette) {
            newPaletteSelections[op.id] = palette.id;

            // If palette has ref_cartao, find and populate material
            if (palette.ref_cartao && materialsData.length > 0) {
              const materialRecord = materialsData.find(
                (m) => m.referencia === palette.ref_cartao,
              );

              if (materialRecord) {
                newMaterialSelections[op.id] = {
                  material: materialRecord.material?.toUpperCase() || undefined,
                  carateristica:
                    materialRecord.carateristica?.toUpperCase() || undefined,
                  cor: materialRecord.cor?.toUpperCase() || undefined,
                };
              }
            }
          }
        }

        // Initialize material selections from material_id (if no palette)
        if (
          !newMaterialSelections[op.id] &&
          op.material_id &&
          materialsData.length > 0
        ) {
          const materialRecord = materialsData.find(
            (m) => m.id === op.material_id,
          );
          if (materialRecord) {
            newMaterialSelections[op.id] = {
              material: materialRecord.material?.toUpperCase() || undefined,
              carateristica:
                materialRecord.carateristica?.toUpperCase() || undefined,
              cor: materialRecord.cor?.toUpperCase() || undefined,
            };
          }
        }
      });

      setMaterialSelections(newMaterialSelections);
      setPaletteSelections(newPaletteSelections);
    };

    initSelections();
  }, [operations, materialsData, paletes]);

  // INLINE EDITING: Removed old acceptEdit, changeField functions - now using handleFieldChange directly

  // Simplified row duplication for workflow splits
  const handleDuplicateRow = async (operation: ProductionOperation) => {
    const result = await duplicateOperationRow(supabase, operation);

    if (result.success) {
      onRefresh();
      onMainRefresh();
    } else {
      alert(`Erro ao duplicar operação: ${result.error}`);
    }
  };

  const handleFieldChange = async (
    operationId: string,
    field: string,
    value: any,
  ) => {
    try {
      // Normalize numeric fields - support decimals
      let normalizedValue = value;
      if (field === "num_placas_print" || field === "num_placas_corte") {
        const n = parseFloat(String(value));
        normalizedValue = Number.isFinite(n) ? n : 0;

        // VALIDATION: Check quantity constraints before saving
        const operation = operations.find((op) => op.id === operationId);
        if (operation && normalizedValue > 0) {
          const validation = await validateOperationQuantity(
            supabase,
            operation,
            normalizedValue,
          );

          if (!validation.valid) {
            alert(`Erro de validação: ${validation.error}`);
            return;
          }

          if (validation.warning) {
            console.log("Aviso:", validation.warning);
          }
        }
      }

      // Get old value first for audit
      const operation = operations.find((op) => op.id === operationId);
      const oldValue = operation ? (operation as any)[field] : null;

      const { error } = await supabase
        .from("producao_operacoes")
        .update({ [field]: normalizedValue })
        .eq("id", operationId);

      if (error) throw error;

      // LOG AUDIT: Field change
      await logFieldUpdate(
        supabase,
        operationId,
        field,
        oldValue,
        normalizedValue,
      );

      // Sync Impressao -> Corte when relevant fields change
      const sourceOp = operation;
      if (
        sourceOp?.Tipo_Op === "Impressao" &&
        [
          "material_id",
          "num_placas_print",
          "notas_imp",
          "N_Pal",
          "data_operacao",
        ].includes(field)
      ) {
        // Find ALL linked Corte operations using source_impressao_id
        const { data: linkedCorteOps } = await supabase
          .from("producao_operacoes")
          .select("id")
          .eq("source_impressao_id", operationId);

        if (linkedCorteOps && linkedCorteOps.length > 0) {
          // Update fields for ALL linked corte operations
          const corteUpdate: Record<string, any> = {};
          if (field === "material_id")
            corteUpdate.material_id = normalizedValue;
          if (field === "num_placas_print")
            corteUpdate.QT_print = normalizedValue;
          if (field === "notas_imp") corteUpdate.notas = normalizedValue;
          if (field === "N_Pal") corteUpdate.N_Pal = normalizedValue;
          if (field === "data_operacao")
            corteUpdate.data_operacao = normalizedValue;

          if (Object.keys(corteUpdate).length > 0) {
            for (const corteOp of linkedCorteOps) {
              const { error: syncErr } = await supabase
                .from("producao_operacoes")
                .update(corteUpdate)
                .eq("id", corteOp.id);

              if (!syncErr) {
                // log each synced field update
                for (const [k, v] of Object.entries(corteUpdate)) {
                  // eslint-disable-next-line no-await-in-loop
                  await logFieldUpdate(supabase, corteOp.id, k, undefined, v);
                }
              }
            }
          }
        }
      }

      onRefresh();
    } catch (err) {
      console.error("Error updating operation:", err);
      alert("Erro ao atualizar operação");
    }
  };

  const handleAddOperation = async () => {
    try {
      // Generate no_interno auto-number
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      const timeStr = format(now, "HHmmss");
      const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
      const typePrefix =
        type === "Impressao"
          ? "IMP"
          : type === "Impressao_Flexiveis"
            ? "FLX"
            : "CRT";
      const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}`;

      const operationData = {
        item_id: itemId,
        folha_obra_id: folhaObraId,
        Tipo_Op: type,
        data_operacao: new Date().toISOString().split("T")[0],
        no_interno,
        num_placas_print: 0,
        num_placas_corte: 0,
        concluido: false,
      };

      const { data: savedOperation, error } = await supabase
        .from("producao_operacoes")
        .insert([operationData])
        .select()
        .single();

      if (error) throw error;

      // LOG AUDIT: Operation creation
      await logOperationCreation(supabase, savedOperation.id, operationData);

      // NEW: For Impressão, auto-create linked Corte operation
      if (type === "Impressao") {
        const corteNoInterno = `${no_interno}-CORTE`;

        const corteData = {
          Tipo_Op: "Corte",
          item_id: itemId,
          folha_obra_id: folhaObraId,
          data_operacao: new Date().toISOString().split("T")[0],
          no_interno: corteNoInterno,
          num_placas_corte: 0,
          QT_print: 0, // Will be updated when Print field is filled
          source_impressao_id: savedOperation.id, // LINK TO SOURCE PRINT
          concluido: false,
        };

        const { data: corteOp, error: corteError } = await supabase
          .from("producao_operacoes")
          .insert([corteData])
          .select()
          .single();

        if (!corteError && corteOp) {
          await logOperationCreation(supabase, corteOp.id, corteData);
        }
      }

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error adding operation:", err);
      alert("Erro ao adicionar operação");
    }
  };

  const handleDeleteOperation = async (operationId: string) => {
    if (!window.confirm("Tem certeza que deseja eliminar esta operação?"))
      return;

    try {
      // Get operation details before deleting for audit log
      const operation = operations.find((op) => op.id === operationId);

      const { error } = await supabase
        .from("producao_operacoes")
        .delete()
        .eq("id", operationId);

      if (error) throw error;

      // LOG AUDIT: Operation deletion
      if (operation) {
        await logOperationDeletion(supabase, operationId, operation);
      }

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error deleting operation:", err);
      alert("Erro ao eliminar operação");
    }
  };

  // INLINE EDITING: Removed old batch split handlers - now using simple handleDuplicateRow

  const handleComplete = async (operationId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;

      const { error } = await supabase
        .from("producao_operacoes")
        .update({
          concluido: newValue,
          data_conclusao: newValue ? new Date().toISOString() : null,
        })
        .eq("id", operationId);

      if (error) throw error;

      // LOG AUDIT: Completion status change
      await logFieldUpdate(
        supabase,
        operationId,
        "concluido",
        currentValue,
        newValue,
      );

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error updating completion:", err);
      alert("Erro ao atualizar conclusão");
    }
  };

  const handlePaletteSelection = async (
    operationId: string,
    paletteId: string,
  ) => {
    // If empty value is selected, clear palette and enable material dropdowns
    if (!paletteId) {
      setPaletteSelections((prev) => ({
        ...prev,
        [operationId]: "",
      }));

      // Clear material selections to allow manual input
      setMaterialSelections((prev) => ({
        ...prev,
        [operationId]: {
          material: undefined,
          carateristica: undefined,
          cor: undefined,
        },
      }));

      // Clear palette and material from operation
      await handleFieldChange(operationId, "N_Pal", "");
      await handleFieldChange(operationId, "material_id", null);
      return;
    }

    // Find the selected palette
    const selectedPalette = paletes.find((p) => p.id === paletteId);

    if (!selectedPalette) {
      return;
    }

    // Update palette selection in local state immediately
    setPaletteSelections((prev) => ({
      ...prev,
      [operationId]: paletteId,
    }));

    // Save palette number to database
    await handleFieldChange(operationId, "N_Pal", selectedPalette.no_palete);

    // If the palette has a reference, also update material
    if (selectedPalette.ref_cartao) {
      const matchingMaterial = materialsData.find(
        (m) => m.referencia === selectedPalette.ref_cartao,
      );

      if (matchingMaterial) {
        // Update material_id in database
        await handleFieldChange(
          operationId,
          "material_id",
          matchingMaterial.id,
        );

        // Update material selections immediately for UI display (normalized to uppercase)
        setMaterialSelections((prev) => ({
          ...prev,
          [operationId]: {
            material: matchingMaterial.material?.toUpperCase() || undefined,
            carateristica:
              matchingMaterial.carateristica?.toUpperCase() || undefined,
            cor: matchingMaterial.cor?.toUpperCase() || undefined,
          },
        }));
      }
    }
  };

  const handleMaterialChange = (
    operationId: string,
    field: "material" | "carateristica" | "cor",
    value: string,
  ) => {
    // INLINE EDITING: Always use handleFieldChange (no edit mode check)

    setMaterialSelections((prev) => {
      const current = prev[operationId] || {};

      if (field === "material") {
        const newSelection = {
          material: value,
          carateristica: undefined,
          cor: undefined,
        };
        const materialId = getMaterialId(value);
        handleFieldChange(operationId, "material_id", materialId || null);
        return { ...prev, [operationId]: newSelection };
      }

      if (field === "carateristica") {
        const newSelection = {
          ...current,
          carateristica: value,
          cor: undefined,
        };
        const materialId = getMaterialId(current.material, value);
        handleFieldChange(operationId, "material_id", materialId || null);
        return { ...prev, [operationId]: newSelection };
      }

      if (field === "cor") {
        const newSelection = { ...current, cor: value };
        const materialId = getMaterialId(
          current.material,
          current.carateristica,
          value,
        );
        handleFieldChange(operationId, "material_id", materialId || null);
        return { ...prev, [operationId]: newSelection };
      }

      return prev;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg uppercase">
          Operações de {type.replace("_", " ")}
        </h3>
        <Button size="sm" variant="default" onClick={handleAddOperation}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[100px]">Plano</TableHead>
              <TableHead className="w-[60px]">Cores</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[140px]">Palete</TableHead>
              <TableHead className="w-[120px]">Material</TableHead>
              <TableHead className="w-[120px]">Características</TableHead>
              <TableHead className="w-[120px]">Cor</TableHead>
              <TableHead className="w-[80px]">Print</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[80px] text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">C</span>
                    </TooltipTrigger>
                    <TooltipContent>Concluído</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => {
              return (
                <TableRow key={op.id}>
                  {/* Data */}
                  <TableCell>
                    <DatePicker
                      selected={
                        op.data_operacao
                          ? new Date(op.data_operacao)
                          : undefined
                      }
                      onSelect={(date: Date | undefined) => {
                        handleFieldChange(
                          op.id,
                          "data_operacao",
                          date ? date.toISOString().split("T")[0] : null,
                        );
                      }}
                    />
                  </TableCell>

                  {/* Plano Nome */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={op.plano_nome || ""}
                        onChange={(e) =>
                          handleFieldChange(op.id, "plano_nome", e.target.value)
                        }
                        placeholder="Plano A"
                        className="w-full text-sm"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {op.batch_id && (
                          <Badge variant="outline" className="text-xs">
                            Lote {op.placas_neste_batch}/{op.total_placas}
                          </Badge>
                        )}
                        {op.plano_nome && (
                          <Badge variant="outline" className="text-xs">
                            Do Designer
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Cores */}
                  <TableCell>
                    <Input
                      value={op.cores || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d?\/?\d?$/.test(value) || value === "") {
                          handleFieldChange(op.id, "cores", value);
                        }
                      }}
                      placeholder="4/4"
                      className="w-[50px] text-sm font-mono text-center"
                    />
                  </TableCell>

                  {/* Operador */}
                  <TableCell>
                    <Select
                      value={op.operador_id || ""}
                      onValueChange={(v) =>
                        handleFieldChange(op.id, "operador_id", v || null)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Operador" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Máquina */}
                  <TableCell>
                    <Select
                      value={op.maquina || ""}
                      onValueChange={(v) =>
                        handleFieldChange(op.id, "maquina", v || null)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines
                          .filter((m) =>
                            type === "Impressao"
                              ? m.tipo === "Impressao"
                              : m.tipo === "Impressao_vinil",
                          )
                          .map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Palete */}
                  <TableCell>
                    <Combobox
                      options={[
                        { value: "", label: "Sem palete" },
                        ...paletes.map((palete) => ({
                          value: palete.id,
                          label: palete.no_palete,
                        })),
                      ]}
                      value={paletteSelections[op.id] || op.N_Pal || ""}
                      onChange={(v) => handlePaletteSelection(op.id, v)}
                    />
                  </TableCell>

                  {/* Material */}
                  <TableCell>
                    <Combobox
                      options={materialOptions}
                      value={materialSelections[op.id]?.material || ""}
                      onChange={(v) =>
                        handleMaterialChange(op.id, "material", v)
                      }
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  {/* Características */}
                  <TableCell>
                    <Combobox
                      options={getCaracteristicaOptions(
                        materialSelections[op.id]?.material,
                      )}
                      value={materialSelections[op.id]?.carateristica || ""}
                      onChange={(v) =>
                        handleMaterialChange(op.id, "carateristica", v)
                      }
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  {/* Cor */}
                  <TableCell>
                    <Combobox
                      options={getCorOptions(
                        materialSelections[op.id]?.material,
                        materialSelections[op.id]?.carateristica,
                      )}
                      value={materialSelections[op.id]?.cor || ""}
                      onChange={(v) => handleMaterialChange(op.id, "cor", v)}
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  {/* Num Placas Print */}
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={String(op.num_placas_print ?? "")}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
                          handleFieldChange(op.id, "num_placas_print", value);
                        }
                      }}
                      className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </TableCell>

                  {/* Notas */}
                  <TableCell>
                    <SimpleNotasPopover
                      value={op.observacoes || ""}
                      onSave={(value) =>
                        handleFieldChange(op.id, "observacoes", value)
                      }
                      placeholder="Notas..."
                      label="Notas"
                      buttonSize="icon"
                    />
                  </TableCell>

                  {/* Concluído */}
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={op.concluido || false}
                        onCheckedChange={(checked) =>
                          handleFieldChange(op.id, "concluido", !!checked)
                        }
                      />
                    </div>
                  </TableCell>

                  {/* Ações */}
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDuplicateRow(op)}
                        title="Duplicar linha"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDeleteOperation(op.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Corte From Print Table Component - For operations linked to print jobs
interface CorteFromPrintTableProps {
  operations: ProductionOperation[];
  itemId: string;
  folhaObraId: string;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}

function CorteFromPrintTable({
  operations,
  itemId,
  folhaObraId,
  supabase,
  onRefresh,
  onMainRefresh,
}: CorteFromPrintTableProps) {
  const { operators, machines } = useTableData();
  const { materialsData } = useMaterialsCascading();

  // Group operations by source_impressao_id for aggregation
  const groupedOps = useMemo(() => {
    const groups: Record<
      string,
      {
        sourceId: string;
        operations: ProductionOperation[];
        totalCut: number;
        qtPrint: number;
        material: string;
        carateristica: string;
        cor: string;
        nPal: string;
      }
    > = {};

    operations.forEach((op) => {
      if (!op.source_impressao_id) return;

      if (!groups[op.source_impressao_id]) {
        groups[op.source_impressao_id] = {
          sourceId: op.source_impressao_id,
          operations: [],
          totalCut: 0,
          qtPrint: op.QT_print || 0,
          material: "",
          carateristica: "",
          cor: "",
          nPal: op.N_Pal || "",
        };

        if (op.material_id && materialsData.length > 0) {
          const mat = materialsData.find((m) => m.id === op.material_id);
          if (mat) {
            groups[op.source_impressao_id].material = mat.material || "";
            groups[op.source_impressao_id].carateristica =
              mat.carateristica || "";
            groups[op.source_impressao_id].cor = mat.cor || "";
          }
        }
      }

      groups[op.source_impressao_id].operations.push(op);
      groups[op.source_impressao_id].totalCut += op.num_placas_corte || 0;
    });

    return Object.values(groups);
  }, [operations, materialsData]);

  const handleFieldChange = async (
    operationId: string,
    field: string,
    value: any,
  ) => {
    try {
      let normalizedValue = value;

      if (field === "num_placas_corte") {
        const op = operations.find((o) => o.id === operationId);
        const n = parseFloat(String(value));
        normalizedValue = Number.isFinite(n) ? n : 0;

        if (op && op.source_impressao_id) {
          const group = groupedOps.find(
            (g) => g.sourceId === op.source_impressao_id,
          );
          if (group) {
            const newTotal =
              group.totalCut - (op.num_placas_corte || 0) + normalizedValue;
            if (newTotal > group.qtPrint) {
              alert(
                `Total de corte (${newTotal}) não pode exceder QT Print (${group.qtPrint})`,
              );
              return;
            }
          }
        }
      }

      const operation = operations.find((op) => op.id === operationId);
      const oldValue = operation ? (operation as any)[field] : null;

      const { error } = await supabase
        .from("producao_operacoes")
        .update({ [field]: normalizedValue })
        .eq("id", operationId);

      if (error) throw error;

      await logFieldUpdate(
        supabase,
        operationId,
        field,
        oldValue,
        normalizedValue,
      );

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error updating operation:", err);
      alert("Erro ao atualizar operação");
    }
  };

  const handleDuplicateRow = async (operation: ProductionOperation) => {
    try {
      const result = await duplicateOperationRow(supabase, operation);
      if (!result.success) {
        alert(`Erro ao duplicar operação: ${result.error}`);
        return;
      }
      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error duplicating operation:", err);
      alert("Erro ao duplicar operação");
    }
  };

  const handleDeleteOperation = async (operationId: string) => {
    if (!window.confirm("Tem certeza que deseja eliminar esta operação?"))
      return;

    try {
      const operation = operations.find((op) => op.id === operationId);

      const { error } = await supabase
        .from("producao_operacoes")
        .delete()
        .eq("id", operationId);

      if (error) throw error;

      if (operation) {
        await logOperationDeletion(supabase, operationId, operation);
      }

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error deleting operation:", err);
      alert("Erro ao eliminar operação");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg">Corte a partir de Impressão</h3>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[100px]">QT Print</TableHead>
              <TableHead className="w-[100px]">Corte</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[70px] text-center">C</TableHead>
              <TableHead className="w-[90px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => (
              <TableRow key={op.id}>
                {/* Data */}
                <TableCell>
                  <DatePicker
                    selected={
                      op.data_operacao ? new Date(op.data_operacao) : undefined
                    }
                    onSelect={(date: Date | undefined) =>
                      handleFieldChange(
                        op.id,
                        "data_operacao",
                        date ? date.toISOString().split("T")[0] : null,
                      )
                    }
                  />
                </TableCell>

                {/* Operador */}
                <TableCell>
                  <Select
                    value={op.operador_id || ""}
                    onValueChange={(v) =>
                      handleFieldChange(op.id, "operador_id", v || null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Máquina */}
                <TableCell>
                  <Select
                    value={op.maquina || ""}
                    onValueChange={(v) =>
                      handleFieldChange(op.id, "maquina", v || null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines
                        .filter((m) => m.tipo === "Corte")
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* QT Print (read-only from linked print) */}
                <TableCell>{op.QT_print ?? "-"}</TableCell>

                {/* Corte */}
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={String(op.num_placas_corte ?? "")}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
                        handleFieldChange(op.id, "num_placas_corte", value);
                      }
                    }}
                    className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </TableCell>

                {/* Notas */}
                <TableCell>
                  <SimpleNotasPopover
                    value={op.observacoes || ""}
                    onSave={(value) =>
                      handleFieldChange(op.id, "observacoes", value)
                    }
                    placeholder="Notas..."
                    label="Notas"
                    buttonSize="icon"
                  />
                </TableCell>

                {/* Concluído */}
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={op.concluido || false}
                      onCheckedChange={(checked) =>
                        handleFieldChange(op.id, "concluido", !!checked)
                      }
                    />
                  </div>
                </TableCell>

                {/* Ações */}
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDuplicateRow(op)}
                      title="Duplicar linha"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDeleteOperation(op.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
