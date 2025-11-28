import { useCallback, MutableRefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, LoadingState, ClienteOption } from "@/types/producao";

/**
 * Production Jobs Hook - Global Filter Pattern
 *
 * Fetches ALL jobs matching the filters from Supabase (no tab filtering).
 * Tab filtering and counts are computed client-side in ProducaoClient.
 *
 * Key Features:
 * - Global item/codigo search across all jobs
 * - Fetches ALL matching data regardless of tab
 * - No date limits when filters are active (searches entire Supabase)
 * - PHC date enrichment from business system
 * - Client name resolution from customer_id
 *
 * @param supabase - Supabase client instance
 * @param clientesRef - Ref containing cliente options for name resolution
 * @param setLoading - Loading state setter
 * @param setError - Error state setter
 * @param setJobs - Jobs state setter (now receives ALL filtered jobs)
 * @returns Object with fetchJobs function
 */
export function useProducaoJobs(
  supabase: SupabaseClient,
  clientesRef: MutableRefObject<ClienteOption[]>,
  setLoading: React.Dispatch<React.SetStateAction<LoadingState>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>,
  setHasMoreJobs: React.Dispatch<React.SetStateAction<boolean>>,
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>,
) {
  /**
   * Fetch ALL jobs matching filters from Supabase
   * Tab filtering happens client-side in ProducaoClient
   *
   * @param filters - Filter object with all filter criteria (NO activeTab)
   */
  const fetchJobs = useCallback(
    async (
      page = 0,
      reset = false,
      filters: {
        foF?: string;
        orcF?: string;
        campF?: string;
        itemF?: string;
        codeF?: string;
        clientF?: string;
        effectiveFoF?: string;
        effectiveOrcF?: string;
        effectiveCampF?: string;
        effectiveItemF?: string;
        effectiveCodeF?: string;
        effectiveClientF?: string;
        showFatura?: boolean;
        // activeTab removed - no longer used in fetch
      } = {},
    ) => {
      setLoading((prev) => ({ ...prev, jobs: true }));
      try {
        // Check if any filters are active
        const hasActiveFilters = !!(
          filters.foF?.trim() ||
          filters.orcF?.trim() ||
          filters.campF?.trim() ||
          filters.itemF?.trim() ||
          filters.codeF?.trim() ||
          filters.clientF?.trim()
        );

        // STEP 1: Handle item/codigo filters FIRST (search globally in ALL of Supabase)
        let jobIds: string[] | null = null;
        const itemFiltersActive = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        );

        if (itemFiltersActive) {
          const itemFilter = filters.itemF?.trim();
          const codeFilter = filters.codeF?.trim();

          // Combine all search terms
          const searchTerms = [];
          if (itemFilter) searchTerms.push(itemFilter);
          if (codeFilter) searchTerms.push(codeFilter);

          let allJobIds: string[] = [];

          // Search for each term in both codigo and descricao fields - NO DATE LIMIT
          for (const term of searchTerms) {
            const { data: itemData, error: itemErr } = await supabase
              .from("items_base")
              .select("folha_obra_id")
              .or(`descricao.ilike.%${term}%,codigo.ilike.%${term}%`);

            if (!itemErr && itemData) {
              const jobIdsForTerm = itemData.map(
                (item: any) => item.folha_obra_id,
              );
              allJobIds = [...allJobIds, ...jobIdsForTerm];
            }
          }

          if (allJobIds.length > 0) {
            const uniqueJobIds = Array.from(new Set(allJobIds));
            jobIds = uniqueJobIds;
          } else {
            setJobs([]);
            setHasMoreJobs(false);
            setCurrentPage(0);
            setLoading((prev) => ({ ...prev, jobs: false }));
            return;
          }
        }

        // STEP 2: Build the base query - NO DATE LIMITS when filters are active
        let query = supabase.from("folhas_obras").select(
          `
          id,
          Numero_do_,
          numero_orc,
          Trabalho,
          Data_efeti,
          Observacoe,
          Nome,
          customer_id,
          prioridade,
          pendente,
          created_at,
          updated_at,
          Euro__tota
        `,
          { count: "exact" },
        );

        // If we have job IDs from item search, filter by those
        if (jobIds) {
          query = query.in("id", jobIds);
        }

        // STEP 3: Apply text filters - search ALL of Supabase when filters active
        if (hasActiveFilters) {
          // When filters are active: NO date limits, search everything
          if (filters.foF?.trim()) {
            query = query.ilike("Numero_do_", `%${filters.foF.trim()}%`);
          }
          if (filters.orcF?.trim()) {
            query = query.ilike("numero_orc", `%${filters.orcF.trim()}%`);
          }
          if (filters.campF?.trim()) {
            query = query.ilike("Trabalho", `%${filters.campF.trim()}%`);
          }
          if (filters.clientF?.trim()) {
            query = query.ilike("Nome", `%${filters.clientF.trim()}%`);
          }
        } else {
          // When NO filters: limit to recent 12 months for default display
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
          query = query.gte("created_at", twelveMonthsAgo.toISOString());
        }

        // Order by created_at descending
        query = query.order("created_at", { ascending: false });

        // Execute the query - NO pagination, get ALL results
        const { data: jobsData, error, count } = await query;

        if (error) {
          console.error("Supabase error details:", error);
          throw error;
        }

        // Map database columns to Job interface
        let filteredJobs: Job[] = (jobsData || []).map((row: any) => {
          const clienteName = row.Nome || "";
          const customerId = row.customer_id;

          // Find the cliente name from the ID if not in Nome field
          let resolvedClienteName = clienteName;
          let resolvedClienteId: string | null = null;

          if (customerId) {
            const matchedCliente = clientesRef.current.find(
              (c) => c.value === customerId.toString(),
            );
            if (matchedCliente) {
              resolvedClienteName = matchedCliente.label;
              resolvedClienteId = matchedCliente.value;
            }
          } else if (clienteName) {
            const matchedCliente = clientesRef.current.find(
              (c) => c.label === clienteName,
            );
            if (matchedCliente) {
              resolvedClienteId = matchedCliente.value;
            }
          }

          return {
            id: row.id,
            numero_fo: row.Numero_do_ ? String(row.Numero_do_) : "",
            numero_orc: row.numero_orc ?? null,
            nome_campanha: row.Trabalho || "",
            data_saida: row.Data_efeti ?? null,
            prioridade: row.prioridade ?? false,
            pendente: row.pendente ?? false,
            notas: row.Observacoe ?? null,
            concluido: null, // Will be enriched with logistics data
            saiu: null,
            fatura: null,
            created_at: row.created_at ?? null,
            data_in: row.Data_efeti ?? null,
            cliente: resolvedClienteName,
            id_cliente: resolvedClienteId,
            customer_id: customerId,
            data_concluido: null,
            updated_at: row.updated_at ?? null,
            euro_tota: row.Euro__tota ?? null,
          };
        });

        // Enrich data_in with authoritative date from PHC view when available
        try {
          const foNumbers = Array.from(
            new Set(
              filteredJobs
                .map((j) => j.numero_fo)
                .filter((n): n is string => !!n && n.trim() !== ""),
            ),
          );
          if (foNumbers.length > 0) {
            const { data: phcDates, error: phcErr } = await supabase
              .schema("phc")
              .from("folha_obra_with_orcamento")
              .select("folha_obra_number, folha_obra_date")
              .in("folha_obra_number", foNumbers);
            if (!phcErr && phcDates) {
              const dateMap = new Map<string, string | null>();
              phcDates.forEach((r: any) => {
                if (r?.folha_obra_number) {
                  dateMap.set(
                    String(r.folha_obra_number),
                    r.folha_obra_date || null,
                  );
                }
              });
              filteredJobs = filteredJobs.map((j) => ({
                ...j,
                data_in: dateMap.get(j.numero_fo) ?? j.data_in ?? null,
              }));
            }
          }
        } catch (e) {
          console.warn("PHC date enrichment error:", e);
        }

        // STEP 4: Enrich jobs with logistics completion status
        // This is needed for client-side tab filtering
        try {
          const jobIdsToCheck = filteredJobs.map((j) => j.id);

          if (jobIdsToCheck.length > 0) {
            // Get all items for these jobs
            const { data: itemsData } = await supabase
              .from("items_base")
              .select("id, folha_obra_id")
              .in("folha_obra_id", jobIdsToCheck);

            if (itemsData && itemsData.length > 0) {
              const itemIds = itemsData.map((i: any) => i.id);

              // Get logistics entries for these items
              const { data: logisticsData } = await supabase
                .from("logistica_entregas")
                .select("item_id, concluido")
                .in("item_id", itemIds);

              // Group items by job
              const itemsByJob = new Map<string, any[]>();
              itemsData.forEach((item: any) => {
                if (!itemsByJob.has(item.folha_obra_id)) {
                  itemsByJob.set(item.folha_obra_id, []);
                }
                itemsByJob.get(item.folha_obra_id)!.push(item);
              });

              // Determine completion status for each job
              filteredJobs = filteredJobs.map((job) => {
                const jobItems = itemsByJob.get(job.id) || [];

                if (jobItems.length === 0) {
                  // No items = not completed (em_curso)
                  return { ...job, concluido: false };
                }

                // Check if ALL items have ALL logistics entries with concluido=true
                const allCompleted = jobItems.every((item) => {
                  const logEntries = (logisticsData || []).filter(
                    (l: any) => l.item_id === item.id,
                  );
                  if (logEntries.length === 0) return false;
                  return logEntries.every((e: any) => e.concluido === true);
                });

                return { ...job, concluido: allCompleted };
              });
            } else {
              // No items for any jobs = all are not completed
              filteredJobs = filteredJobs.map((job) => ({
                ...job,
                concluido: false,
              }));
            }
          }
        } catch (e) {
          console.warn("Logistics enrichment error:", e);
          // Default to not completed if error
          filteredJobs = filteredJobs.map((job) => ({
            ...job,
            concluido: false,
          }));
        }

        // Set ALL jobs - tab filtering happens in ProducaoClient
        setJobs(filteredJobs);
        setHasMoreJobs(false); // No pagination needed, we fetch all
        setCurrentPage(0);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        setError(
          `Failed to load production jobs: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setLoading((prev) => ({ ...prev, jobs: false }));
      }
    },
    [
      supabase,
      clientesRef,
      setLoading,
      setJobs,
      setHasMoreJobs,
      setCurrentPage,
      setError,
    ],
  );

  return { fetchJobs };
}
