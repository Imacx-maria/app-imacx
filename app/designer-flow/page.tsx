"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/useDebounce";
import { useComplexidades } from "@/hooks/useComplexidades";
import type { Job, Item, UpdateItemParams } from "./types";
import { DesignerFlowFilters } from "@/components/designer-flow/DesignerFlowFilters";
import {
  DesignerJobsTable,
  type SortColumn,
} from "@/components/designer-flow/DesignerJobsTable";
import { fetchItems, fetchJobs } from "./lib/queries";
import { parseNumericField } from "./lib/helpers";
import { ComplexidadeCombobox } from "@/components/ui/ComplexidadeCombobox";

const DesignerItemsDrawer = dynamic(
  () => import("@/components/designer-flow/DesignerItemsDrawer"),
  { ssr: false },
);

type TabValue = "aberto" | "paginados";

export default function DesignerFlow() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<TabValue>("aberto");
  const [foFilter, setFoFilter] = useState("");
  const [orcFilter, setOrcFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [codigoFilter, setCodigoFilter] = useState("");
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [allDesignerItems, setAllDesignerItems] = useState<any[]>([]);
  const [jobDesigners, setJobDesigners] = useState<Record<string, string>>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [itemPlanos, setItemPlanos] = useState<Record<string, any[]>>({});
  const [sortColumn, setSortColumn] = useState<SortColumn>("prioridade");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 40;

  const { complexidades, isLoading: isLoadingComplexidades } =
    useComplexidades();

  const debouncedFoFilter = useDebounce(foFilter, 300);
  const debouncedOrcFilter = useDebounce(orcFilter, 300);
  const debouncedCampaignFilter = useDebounce(campaignFilter, 300);
  const debouncedItemFilter = useDebounce(itemFilter, 300);
  const debouncedCodigoFilter = useDebounce(codigoFilter, 300);

  const effectiveFoFilter =
    debouncedFoFilter.trim().length >= 3 ? debouncedFoFilter : "";
  const effectiveOrcFilter =
    debouncedOrcFilter.trim().length >= 3 ? debouncedOrcFilter : "";
  const effectiveCampaignFilter =
    debouncedCampaignFilter.trim().length >= 3 ? debouncedCampaignFilter : "";
  const effectiveItemFilter =
    debouncedItemFilter.trim().length >= 3 ? debouncedItemFilter : "";
  const effectiveCodigoFilter =
    debouncedCodigoFilter.trim().length >= 3 ? debouncedCodigoFilter : "";

  const loadJobs = useCallback(async () => {
    setLoading(true);
    // Fetch ALL jobs (both tabs) - filtering happens client-side
    const jobsData = await fetchJobs(
      supabase,
      effectiveFoFilter,
      effectiveOrcFilter,
      effectiveCampaignFilter,
      effectiveItemFilter,
      effectiveCodigoFilter,
    );
    setAllJobs(jobsData);
    setSelectedJob(null);
    setLoading(false);
  }, [
    supabase,
    effectiveFoFilter,
    effectiveOrcFilter,
    effectiveCampaignFilter,
    effectiveItemFilter,
    effectiveCodigoFilter,
  ]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const loadAllData = async () => {
      if (allJobs.length === 0) {
        setAllItems([]);
        setAllDesignerItems([]);
        setJobDesigners({});
        return;
      }

      const jobIds = allJobs.map((job) => job.id);
      const itemsData = await fetchItems(supabase, jobIds);
      setAllItems(itemsData);

      try {
        const { data: designerData, error } = await supabase
          .from("designer_items")
          .select(
            "id, item_id, paginacao, designer, items_base!inner(folha_obra_id)",
          )
          .in(
            "item_id",
            itemsData.map((item) => item.id),
          );

        if (!error && designerData) {
          setAllDesignerItems(designerData);

          const designersMap: Record<string, string> = {};
          designerData.forEach((item: any) => {
            const base = Array.isArray(item.items_base)
              ? item.items_base[0]
              : item.items_base;
            if (base?.folha_obra_id && item.designer) {
              designersMap[base.folha_obra_id] = item.designer;
            }
          });
          setJobDesigners(designersMap);
        }
      } catch (error) {
        console.error("Error fetching designer items:", error);
      }
    };

    loadAllData();
  }, [allJobs, supabase]);

  const jobItems = useMemo(() => {
    if (!selectedJob) return [];
    return allItems.filter((item) => item.folha_obra_id === selectedJob.id);
  }, [selectedJob, allItems]);

  useEffect(() => {
    const fetchPlanosForJob = async () => {
      if (!selectedJob || jobItems.length === 0) return;
      try {
        const itemIds = jobItems.map((item) => item.id);
        const { data, error } = await supabase
          .from("designer_planos")
          .select("*")
          .in("item_id", itemIds)
          .order("item_id", { ascending: true })
          .order("plano_ordem", { ascending: true });

        if (!error && data) {
          const planosByItem: Record<string, any[]> = {};
          data.forEach((plano) => {
            if (!planosByItem[plano.item_id]) {
              planosByItem[plano.item_id] = [];
            }
            planosByItem[plano.item_id].push(plano);
          });
          setItemPlanos(planosByItem);
        }
      } catch (error) {
        console.error("Error fetching planos:", error);
      }
    };

    fetchPlanosForJob();
  }, [selectedJob, jobItems, supabase]);

  // Filter jobs by active tab (client-side)
  const filteredJobs = useMemo(() => {
    return allJobs.filter((job: any) => {
      const designerItems = job.designerItems || [];
      const itemCount = designerItems.length;
      const completedItems = designerItems.filter(
        (item: any) => !!item.paginacao,
      ).length;
      const allCompleted = itemCount > 0 && completedItems === itemCount;

      if (activeTab === "paginados") {
        // Show only jobs where ALL items are paginados
        return itemCount > 0 && allCompleted;
      }
      // Show jobs that are either empty or have incomplete items
      return itemCount === 0 || !allCompleted;
    });
  }, [allJobs, activeTab]);

  // Compute tab counts from ALL jobs
  const tabCounts = useMemo(() => {
    const aberto = allJobs.filter((job: any) => {
      const designerItems = job.designerItems || [];
      const itemCount = designerItems.length;
      const completedItems = designerItems.filter(
        (item: any) => !!item.paginacao,
      ).length;
      const allCompleted = itemCount > 0 && completedItems === itemCount;
      return itemCount === 0 || !allCompleted;
    }).length;

    const paginados = allJobs.filter((job: any) => {
      const designerItems = job.designerItems || [];
      const itemCount = designerItems.length;
      const completedItems = designerItems.filter(
        (item: any) => !!item.paginacao,
      ).length;
      const allCompleted = itemCount > 0 && completedItems === itemCount;
      return itemCount > 0 && allCompleted;
    }).length;

    return { aberto, paginados };
  }, [allJobs]);

  const sortedJobs = useMemo(() => {
    const sorted = [...filteredJobs].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof Job];
      let bVal: any = b[sortColumn as keyof Job];

      if (sortColumn === "prioridade") {
        const aPriority = a.prioridade ? 1 : 0;
        const bPriority = b.prioridade ? 1 : 0;
        return sortDirection === "desc"
          ? bPriority - aPriority
          : aPriority - bPriority;
      }

      if (sortColumn === "designer") {
        aVal = jobDesigners[a.id] || "";
        bVal = jobDesigners[b.id] || "";
      } else if (sortColumn === "cliente") {
        aVal = a.cliente || "";
        bVal = b.cliente || "";
      } else if (sortColumn === "numero_fo" || sortColumn === "numero_orc") {
        aVal = parseNumericField(aVal);
        bVal = parseNumericField(bVal);
      } else if (sortColumn === "created_at") {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });

    return sorted;
  }, [filteredJobs, sortColumn, sortDirection, jobDesigners]);

  const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedJobs.slice(startIndex, endIndex);
  }, [sortedJobs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    effectiveFoFilter,
    effectiveOrcFilter,
    effectiveCampaignFilter,
    effectiveItemFilter,
    effectiveCodigoFilter,
    activeTab,
  ]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleItemUpdate = useCallback(
    async (params: UpdateItemParams) => {
      setAllItems((prev) =>
        prev.map((item) =>
          item.designer_item_id === params.designerItemId
            ? { ...item, ...params.updates }
            : item,
        ),
      );

      try {
        const { error } = await supabase
          .from("designer_items")
          .update({
            ...params.updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.designerItemId);

        if (error) throw error;
      } catch (error) {
        console.error("Error updating item:", error);
      }
    },
    [supabase],
  );

  const handleDescricaoChange = useCallback(
    async (itemId: string, value: string) => {
      try {
        await supabase
          .from("items_base")
          .update({ descricao: value })
          .eq("id", itemId);
      } catch (error) {
        console.error("Error updating descricao:", error);
      }
    },
    [supabase],
  );

  const handleCodigoChange = useCallback(
    async (itemId: string, value: string) => {
      try {
        await supabase
          .from("items_base")
          .update({ codigo: value })
          .eq("id", itemId);
      } catch (error) {
        console.error("Error updating codigo:", error);
      }
    },
    [supabase],
  );

  const handlePlanosChange = useCallback((itemId: string) => {
    return (planos: any[]) => {
      setItemPlanos((prev) => ({
        ...prev,
        [itemId]: planos,
      }));
    };
  }, []);

  const handleComplexidadeChange = useCallback(async () => {
    return Promise.resolve();
  }, []);

  const handleOpenPathDialog = useCallback(
    (jobId: string, item: Item, index: number) => {
      console.log("Open path dialog", { jobId, itemId: item.id, index });
    },
    [],
  );

  const handleClearFilters = () => {
    setFoFilter("");
    setOrcFilter("");
    setCampaignFilter("");
    setItemFilter("");
    setCodigoFilter("");
  };

  const handleRefresh = () => {
    loadJobs();
  };

  return (
    <div className="w-full space-y-4 px-6 py-6">
      {/* Global Filters - ABOVE TABS */}
      <DesignerFlowFilters
        foFilter={foFilter}
        orcFilter={orcFilter}
        campaignFilter={campaignFilter}
        itemFilter={itemFilter}
        codigoFilter={codigoFilter}
        loading={loading}
        onFoChange={setFoFilter}
        onOrcChange={setOrcFilter}
        onCampaignChange={setCampaignFilter}
        onItemChange={setItemFilter}
        onCodigoChange={setCodigoFilter}
        onClearFilters={handleClearFilters}
        onRefresh={handleRefresh}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aberto">
            Em Aberto ({tabCounts.aberto})
          </TabsTrigger>
          <TabsTrigger value="paginados">
            Paginados ({tabCounts.paginados})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DesignerJobsTable
        jobsLength={sortedJobs.length}
        paginatedJobs={paginatedJobs}
        allItems={allItems}
        allDesignerItems={allDesignerItems}
        jobDesigners={jobDesigners}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onSelectJob={(job) => setSelectedJob(job)}
        selectedJobId={selectedJob?.id ?? null}
        supabase={supabase}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {selectedJob && (
        <DesignerItemsDrawer
          selectedJob={selectedJob}
          jobItems={jobItems}
          itemPlanos={itemPlanos}
          ComplexidadeCombobox={ComplexidadeCombobox}
          complexidades={complexidades}
          isLoadingComplexidades={isLoadingComplexidades}
          openItemId={openItemId}
          onToggleItem={setOpenItemId}
          onPlanosChange={handlePlanosChange}
          onUpdate={handleItemUpdate}
          onDescricaoChange={handleDescricaoChange}
          onCodigoChange={handleCodigoChange}
          onComplexidadeChange={handleComplexidadeChange}
          onOpenPathDialog={handleOpenPathDialog}
          onClose={() => setSelectedJob(null)}
          isOpen={selectedJob !== null}
        />
      )}
    </div>
  );
}
