import { useCallback, MutableRefObject } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Job, LoadingState, ClienteOption } from '@/types/producao'

/**
 * Production Jobs Hook
 *
 * Manages the complex logic for fetching and filtering production jobs.
 * Handles multiple filter types, pagination, logistics status, and PHC integration.
 *
 * Key Features:
 * - Global item/codigo search across all jobs
 * - Logistics pre-filtering for em_curso/concluidos tabs
 * - Complex query building with multiple filter combinations
 * - PHC date enrichment from business system
 * - Client name resolution from customer_id
 * - Pagination with accurate hasMore calculation
 *
 * @param supabase - Supabase client instance
 * @param clientesRef - Ref containing cliente options for name resolution
 * @param setLoading - Loading state setter
 * @param setError - Error state setter
 * @param setJobs - Jobs state setter
 * @param setHasMoreJobs - Has more jobs state setter
 * @param setCurrentPage - Current page state setter
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
  const JOBS_PER_PAGE = 50 // Pagination limit for better performance

  /**
   * Fetch jobs with complex filtering and pagination
   *
   * This function handles multiple filter strategies:
   * 1. Global item search (searches all items across all jobs)
   * 2. Logistics pre-filtering (filters by completion status)
   * 3. Standard field filters (FO, ORC, campaign, client)
   * 4. Tab-based filtering (em_curso, concluidos, pendentes)
   *
   * @param page - Page number for pagination (0-indexed)
   * @param reset - Whether to reset the jobs list or append
   * @param filters - Filter object with all filter criteria
   */
  const fetchJobs = useCallback(
    async (
      page = 0,
      reset = false,
      filters: {
        foF?: string
        orcF?: string
        campF?: string
        itemF?: string
        codeF?: string
        clientF?: string
        effectiveFoF?: string
        effectiveOrcF?: string
        effectiveCampF?: string
        effectiveItemF?: string
        effectiveCodeF?: string
        effectiveClientF?: string
        showFatura?: boolean
        activeTab?: 'em_curso' | 'concluidos' | 'pendentes'
      } = {},
    ) => {
      setLoading((prev) => ({ ...prev, jobs: true }))
      try {
        // Optimized query with specific columns and proper pagination
        const startRange = page * JOBS_PER_PAGE
        const endRange = startRange + JOBS_PER_PAGE - 1

        // Calculate 12 months ago date for completed jobs filter (extended from 2 months)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const twelveMonthsAgoString = twelveMonthsAgo.toISOString()

        // STEP 1: Handle item/codigo filters FIRST (search globally)
        let jobIds: string[] | null = null
        const itemFiltersActive = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        )

        if (itemFiltersActive) {
          const itemFilter = filters.itemF?.trim()
          const codeFilter = filters.codeF?.trim()

          // Combine all search terms
          const searchTerms = []
          if (itemFilter) searchTerms.push(itemFilter)
          if (codeFilter) searchTerms.push(codeFilter)

          let allJobIds: string[] = []

          // Search for each term in both codigo and descricao fields
          for (const term of searchTerms) {
            const { data: itemData, error: itemErr } = await supabase
              .from('items_base')
              .select('folha_obra_id')
              .or(`descricao.ilike.%${term}%,codigo.ilike.%${term}%`)

            if (!itemErr && itemData) {
              const jobIdsForTerm = itemData.map(
                (item: any) => item.folha_obra_id,
              )
              allJobIds = [...allJobIds, ...jobIdsForTerm]
            }
          }

          if (allJobIds.length > 0) {
            // Keep ALL job IDs, including duplicates if same item appears multiple times
            const uniqueJobIds = Array.from(new Set(allJobIds))
            jobIds = uniqueJobIds
          } else {
            setJobs((prev: Job[]) => (reset ? [] : prev))
            setHasMoreJobs(false)
            setCurrentPage(page)
            return
          }
        }

        // STEP 2: Pre-filter by logistics status BEFORE fetching jobs (for em_curso/concluidos tabs)
        // This prevents truncation: we get all matching job IDs first, then fetch only those jobs
        let logisticsFilteredJobIds: string[] | null = null
        const itemFiltersPresent = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        )

        if (
          !jobIds && // Only if we didn't already filter by items
          !itemFiltersPresent && // Only if item filters aren't active
          (filters.activeTab === 'em_curso' || filters.activeTab === 'concluidos')
        ) {
          // First, get all items that match the date criteria (if any)
          let itemsQuery = supabase
            .from('items_base')
            .select('id, folha_obra_id')

          // Apply date filter to items via their jobs if needed
          const hasActiveFilters = !!(
            filters.foF?.trim() ||
            filters.campF?.trim() ||
            filters.clientF?.trim()
          )

          if (!hasActiveFilters) {
            // Get jobs from last 12 months to limit scope
            const twelveMonthsAgo = new Date()
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
            const { data: recentJobs } = await supabase
              .from('folhas_obras')
              .select('id')
              .gte('created_at', twelveMonthsAgo.toISOString())

            if (recentJobs && recentJobs.length > 0) {
              const recentJobIds = recentJobs.map((j: any) => j.id)
              itemsQuery = itemsQuery.in('folha_obra_id', recentJobIds)
            }
          }

          const { data: allItems, error: itemsErr } = await itemsQuery

          if (!itemsErr && allItems && allItems.length > 0) {
            const itemIds = allItems.map((item: any) => item.id)

            // Get logistics entries for these items
            const { data: logisticsData, error: logisticsErr } = await supabase
              .from('logistica_entregas')
              .select('item_id, concluido')
              .in('item_id', itemIds)

            if (!logisticsErr && logisticsData) {
              // Group items by job
              const itemsByJob = new Map<string, any[]>()
              allItems.forEach((item: any) => {
                if (!itemsByJob.has(item.folha_obra_id)) {
                  itemsByJob.set(item.folha_obra_id, [])
                }
                itemsByJob.get(item.folha_obra_id)!.push(item)
              })

              // Filter job IDs based on logistics status
              const matchingJobIds: string[] = []

              // Get all job IDs that have items (from itemsByJob map)
              const jobsWithItems = Array.from(itemsByJob.keys())

              // For em_curso: also include jobs that have NO items (they're in progress)
              if (filters.activeTab === 'em_curso') {
                // Get all jobs from the date range to find jobs without items
                const hasActiveFilters = !!(
                  filters.foF?.trim() ||
                  filters.campF?.trim() ||
                  filters.clientF?.trim()
                )

                let jobsQuery = supabase.from('folhas_obras').select('id')
                if (!hasActiveFilters) {
                  const twelveMonthsAgo = new Date()
                  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
                  jobsQuery = jobsQuery.gte('created_at', twelveMonthsAgo.toISOString())
                }
                const { data: allJobsInRange } = await jobsQuery

                if (allJobsInRange) {
                  // Jobs without items should also be included in em_curso
                  const jobsWithoutItems = allJobsInRange
                    .map((j: any) => j.id)
                    .filter((jobId: string) => !itemsByJob.has(jobId))

                  matchingJobIds.push(...jobsWithoutItems)
                }
              }

              itemsByJob.forEach((jobItems, jobId) => {
                if (filters.activeTab === 'em_curso') {
                  // em_curso: job has ANY item with concluido=false or no logistics entry
                  const hasIncomplete = jobItems.some((item) => {
                    const logEntries = logisticsData.filter((l: any) => l.item_id === item.id)
                    if (logEntries.length === 0) return true // No logistics entry = incomplete
                    return logEntries.some((e: any) => e.concluido !== true)
                  })
                  if (hasIncomplete) matchingJobIds.push(jobId)
                } else if (filters.activeTab === 'concluidos') {
                  // concluidos: ALL items have ALL logistics entries with concluido=true
                  const allCompleted = jobItems.every((item) => {
                    const logEntries = logisticsData.filter((l: any) => l.item_id === item.id)
                    if (logEntries.length === 0) return false // No entries = not completed
                    return logEntries.every((e: any) => e.concluido === true)
                  })
                  if (allCompleted && jobItems.length > 0) matchingJobIds.push(jobId)
                }
              })

              if (matchingJobIds.length > 0) {
                logisticsFilteredJobIds = matchingJobIds
              } else {
                setJobs((prev: Job[]) => (reset ? [] : prev))
                setHasMoreJobs(false)
                setCurrentPage(page)
                return
              }
            }
          }
        }

        // STEP 3: Build the base query - select only existing columns in schema
        let query = supabase.from('folhas_obras').select(
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
          updated_at
        `,
          { count: 'exact' },
        )

        // Include both FO-only and ORC-linked jobs (no forced filter by numero_orc)

        // If we have job IDs from logistics pre-filter, use those
        if (logisticsFilteredJobIds) {
          query = query.in('id', logisticsFilteredJobIds)
        } else if (jobIds) {
          // If we have job IDs from item search, filter by those ONLY
          query = query.in('id', jobIds)
        }

        // STEP 4: Apply other filters (only if no pre-filtering is active)
        if (!logisticsFilteredJobIds && !jobIds) {
          // Check if any filters are active
          const hasActiveFilters = !!(
            filters.foF?.trim() ||
            filters.campF?.trim() ||
            filters.clientF?.trim()
          )

          // Tab-based filtering (completion status)
          if (filters.activeTab === 'concluidos') {
            // For completed jobs, filter by last 12 months (extended from 2 months)
            // Note: data_concluido is in logistica_entregas, not in folhas_obras
            query = query.or(
              `updated_at.gte.${twelveMonthsAgoString},created_at.gte.${twelveMonthsAgoString}`,
            )
          } else if (!hasActiveFilters) {
            // For other tabs (em_curso, pendentes) with no filters: show last 12 months (extended from 4 months)
            const twelveMonthsAgoEmCurso = new Date()
            twelveMonthsAgoEmCurso.setMonth(twelveMonthsAgoEmCurso.getMonth() - 12)
            const twelveMonthsAgoEmCursoString = twelveMonthsAgoEmCurso.toISOString()
            query = query.gte('created_at', twelveMonthsAgoEmCursoString)
          }

          // Direct field filters using real column names
          const {
            effectiveFoF = '',
            effectiveOrcF = '',
            effectiveCampF = '',
            effectiveClientF = '',
          } = filters

          if (effectiveFoF) {
            query = query.ilike('Numero_do_', `%${effectiveFoF}%`)
          }

          if (effectiveOrcF) {
            query = query.ilike('numero_orc', `%${effectiveOrcF}%`)
          }

          if (effectiveCampF) {
            query = query.ilike('Trabalho', `%${effectiveCampF}%`)
          }

          if (effectiveClientF) {
            query = query.ilike('Nome', `%${effectiveClientF}%`)
          }

          // Note: 'fatura' column does not exist in schema; skipping fatura filter
        } else {
          // Apply text filters even when pre-filtering (FO, campaign, client)
          if (filters.foF && filters.foF.trim() !== '') {
            query = query.ilike('Numero_do_', `%${filters.foF.trim()}%`)
          }
          if (filters.orcF && filters.orcF.trim() !== '') {
            query = query.ilike('numero_orc', `%${filters.orcF.trim()}%`)
          }
          if (filters.campF && filters.campF.trim() !== '') {
            query = query.ilike('Trabalho', `%${filters.campF.trim()}%`)
          }
          if (filters.clientF && filters.clientF.trim() !== '') {
            query = query.ilike('Nome', `%${filters.clientF.trim()}%`)
          }
        }

        // Order and pagination (use existing column)
        query = query.order('created_at', { ascending: false })

        // Only apply pagination if we're not filtering by specific job IDs
        if (!logisticsFilteredJobIds && !jobIds) {
          query = query.range(startRange, endRange)
        } else {
          // When pre-filtered, we still need pagination but on the filtered set
          query = query.range(startRange, endRange)
        }

        // Execute the main query
        const { data: jobsData, error, count } = await query

        if (error) {
          console.error('Supabase error details:', error)
          throw error
        }

        // Map database columns to Job interface
        let filteredJobs: Job[] = (jobsData || []).map((row: any) => {
          const clienteName = row.Nome || ''
          const customerId = row.customer_id

          // Find the cliente name from the ID if not in Nome field
          let resolvedClienteName = clienteName
          let resolvedClienteId: string | null = null

          if (customerId) {
            // Use customer_id to find the cliente name and ID
            const matchedCliente = clientesRef.current.find((c) => c.value === customerId.toString())
            if (matchedCliente) {
              resolvedClienteName = matchedCliente.label
              resolvedClienteId = matchedCliente.value
            }
          } else if (clienteName) {
            // Fallback: if no customer_id, try to match by name
            const matchedCliente = clientesRef.current.find((c) => c.label === clienteName)
            if (matchedCliente) {
              resolvedClienteId = matchedCliente.value
            } else if (clientesRef.current.length > 0) {
              console.warn(`Cliente not found for FO ${row.Numero_do_}: "${clienteName}"`)
            }
          }

          return {
            id: row.id,
            numero_fo: row.Numero_do_ ? String(row.Numero_do_) : '',
            numero_orc: row.numero_orc ?? null,
            nome_campanha: row.Trabalho || '',
            data_saida: row.Data_efeti ?? null,
            prioridade: row.prioridade ?? false,
            pendente: row.pendente ?? false,
            notas: row.Observacoe ?? null,
            concluido: null,
            saiu: null,
            fatura: null,
            created_at: row.created_at ?? null,
            data_in: row.Data_efeti ?? null,
            cliente: resolvedClienteName,
            id_cliente: resolvedClienteId,
            customer_id: customerId,
            data_concluido: null,
            updated_at: row.updated_at ?? null,
          }
        })

        // Enrich data_in with authoritative date from PHC view when available
        try {
          const foNumbers = Array.from(
            new Set(
              filteredJobs
                .map((j) => j.numero_fo)
                .filter((n): n is string => !!n && n.trim() !== ''),
            ),
          )
          if (foNumbers.length > 0) {
            // Query folha_obra_with_orcamento view for document dates
            const { data: phcDates, error: phcErr } = await supabase
              .schema('phc')
              .from('folha_obra_with_orcamento')
              .select('folha_obra_number, folha_obra_date')
              .in('folha_obra_number', foNumbers)
            if (!phcErr && phcDates) {
              const dateMap = new Map<string, string | null>()
              phcDates.forEach((r: any) => {
                if (r?.folha_obra_number) {
                  dateMap.set(String(r.folha_obra_number), r.folha_obra_date || null)
                }
              })
              filteredJobs = filteredJobs.map((j) => ({
                ...j,
                data_in: dateMap.get(j.numero_fo) ?? j.data_in ?? null,
              }))
            } else if (phcErr) {
              console.warn('PHC date fetch failed:', phcErr)
            }
          }
        } catch (e) {
          console.warn('PHC date enrichment error:', e)
        }

        // Apply pendente filtering for pendentes tab (this is a simple field filter, no logistics needed)
        if (filters.activeTab === 'pendentes') {
          filteredJobs = filteredJobs.filter((job) => job.pendente === true)
        } else if (filters.activeTab === 'em_curso') {
          // For em_curso tab, exclude pendente jobs (they're already filtered out by pre-filtering)
          filteredJobs = filteredJobs.filter((job) => job.pendente !== true)
        } else if (filters.activeTab === 'concluidos') {
          // For concluidos tab, exclude pendente jobs
          filteredJobs = filteredJobs.filter((job) => job.pendente !== true)
        }

        // Item/codigo filtering is now handled at the beginning of the function

        // Note: Do NOT filter by numero_orc; show FO-only and ORC-linked jobs

        if (filteredJobs) {
          setJobs((prev) => (reset ? filteredJobs : [...prev, ...filteredJobs]))

          // Calculate hasMoreJobs - if we pre-filtered by logistics, count is already accurate
          // Otherwise use the normal count check
          if (logisticsFilteredJobIds) {
            // When pre-filtered, count is the total matching jobs, and we paginate those
            setHasMoreJobs((count || 0) > endRange + 1)
          } else {
            // Normal pagination check
            setHasMoreJobs((count || 0) > endRange + 1)
          }
          setCurrentPage(page)
        }
      } catch (error) {
        console.error('Error fetching jobs:', error)
        setError(
          `Failed to load production jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } finally {
        setLoading((prev) => ({ ...prev, jobs: false }))
      }
    },
    [supabase, clientesRef, setLoading, setJobs, setHasMoreJobs, setCurrentPage, setError],
  )

  return { fetchJobs }
}
