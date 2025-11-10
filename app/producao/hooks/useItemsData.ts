import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Item, LoadingState } from '@/types/producao'

/**
 * Items Data Hook
 *
 * Manages the fetching of item-related data for production jobs:
 * - Items (base item data with designer and logistics info)
 * - Operations (production operations per job)
 * - Designer items (pagination and design-specific data)
 *
 * These functions enrich job data with detailed item-level information
 * needed for production planning and tracking.
 *
 * @param supabase - Supabase client instance
 * @param setLoading - Loading state setter
 * @param setError - Error state setter
 * @param setAllItems - All items state setter
 * @param setAllOperacoes - All operations state setter
 * @param setAllDesignerItems - All designer items state setter
 * @param allItems - Current items state (for fetchDesignerItems dependency)
 * @returns Object with item data fetching functions
 */
export function useItemsData(
  supabase: SupabaseClient,
  setLoading: React.Dispatch<React.SetStateAction<LoadingState>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setAllItems: React.Dispatch<React.SetStateAction<Item[]>>,
  setAllOperacoes: React.Dispatch<React.SetStateAction<any[]>>,
  setAllDesignerItems: React.Dispatch<React.SetStateAction<any[]>>,
  allItems: Item[],
) {
  const ITEMS_FETCH_LIMIT = 200 // Reasonable limit for items per request

  /**
   * Fetch items for loaded jobs
   *
   * Retrieves base item data along with designer and logistics information.
   * Merges data from multiple tables to provide a complete view of each item.
   *
   * @param jobIds - Array of job IDs to fetch items for
   */
  const fetchItems = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      setLoading((prev) => ({ ...prev, items: true }))
      try {
        // Optimized query: only fetch items for loaded jobs
        const { data: itemsData, error } = await supabase
          .from('items_base')
          .select(
            `
          id, folha_obra_id, descricao, codigo,
          quantidade, brindes
        `,
          )
          .in('folha_obra_id', jobIds)
          .limit(ITEMS_FETCH_LIMIT)

        if (error) throw error

        // Fetch designer items data separately for better performance
        const { data: designerData, error: designerError } = await supabase
          .from('designer_items')
          .select('item_id, paginacao')
          .in('item_id', itemsData?.map((item) => item.id) || [])

        if (designerError) throw designerError

        // Fetch logistics data for completion status
        const { data: logisticsData, error: logisticsError } = await supabase
          .from('logistica_entregas')
          .select('item_id, concluido')
          .in('item_id', itemsData?.map((item) => item.id) || [])

        if (logisticsError) throw logisticsError

        if (itemsData) {
          // Merge designer data and logistics data with items data
          const itemsWithDesigner = itemsData.map((item: any) => {
            const designer = designerData?.find((d) => d.item_id === item.id)
            const logistics = logisticsData?.find((l) => l.item_id === item.id)
            return {
              id: item.id,
              folha_obra_id: item.folha_obra_id,
              descricao: item.descricao ?? '',
              codigo: item.codigo ?? '',
              quantidade: item.quantidade ?? null,
              paginacao: designer?.paginacao ?? false,
              brindes: item.brindes ?? false,
              concluido: logistics?.concluido ?? false,
            }
          })

          setAllItems((prev) => {
            // Replace items for these jobs to avoid duplicates
            const filtered = prev.filter(
              (item) => !jobIds.includes(item.folha_obra_id),
            )
            return [...filtered, ...itemsWithDesigner]
          })

          // Update designer items state for the color calculations
          if (designerData) {
            setAllDesignerItems((prev) => {
              // Replace designer items for these jobs to avoid duplicates
              const filtered = prev.filter(
                (designer) =>
                  !itemsData.some((item) => item.id === designer.item_id),
              )
              return [...filtered, ...designerData]
            })
          }
        }
      } catch (error) {
        console.error('Error fetching items:', error)
        setError('Failed to load production items')
      } finally {
        setLoading((prev) => ({ ...prev, items: false }))
      }
    },
    [supabase, setLoading, setError, setAllItems, setAllDesignerItems],
  )

  /**
   * Fetch operations for loaded jobs
   *
   * Retrieves production operations (machining, assembly, etc.) for jobs.
   * Used to track which operations have been completed.
   *
   * @param jobIds - Array of job IDs to fetch operations for
   */
  const fetchOperacoes = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      setLoading((prev) => ({ ...prev, operacoes: true }))
      try {
        const { data: operacoesData, error } = await supabase
          .from('producao_operacoes')
          .select('id, folha_obra_id, concluido')
          .in('folha_obra_id', jobIds)

        if (error) throw error

        if (operacoesData) {
          setAllOperacoes((prev) => {
            // Replace operacoes for these jobs to avoid duplicates
            const filtered = prev.filter(
              (op) => !jobIds.includes(op.folha_obra_id),
            )
            return [...filtered, ...operacoesData]
          })
        }
      } catch (error) {
        console.error('Error fetching operacoes:', error)
        setError('Failed to load production operations')
      } finally {
        setLoading((prev) => ({ ...prev, operacoes: false }))
      }
    },
    [supabase, setLoading, setError, setAllOperacoes],
  )

  /**
   * Fetch designer items for loaded jobs
   *
   * Retrieves design-specific data (pagination, artwork info) for items.
   * This function depends on items already being loaded to get item IDs.
   *
   * @param jobIds - Array of job IDs to fetch designer items for
   */
  const fetchDesignerItems = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      // Get item IDs for these jobs first (exclude pending items)
      const jobItemIds = allItems
        .filter(
          (item) =>
            jobIds.includes(item.folha_obra_id) && !item.id.startsWith('temp-'),
        )
        .map((item) => item.id)

      // If no items are loaded yet, skip designer items fetch
      // This prevents the race condition on initial page load
      if (jobItemIds.length === 0) return

      setLoading((prev) => ({ ...prev, operacoes: true })) // Reuse loading state
      try {
        const { data: designerData, error } = await supabase
          .from('designer_items')
          .select('id, item_id, paginacao')
          .in('item_id', jobItemIds)

        if (error) throw error

        if (designerData) {
          setAllDesignerItems((prev) => {
            // Replace designer items for these jobs to avoid duplicates
            const filtered = prev.filter(
              (designer) => !jobItemIds.includes(designer.item_id),
            )
            return [...filtered, ...designerData]
          })
        }
      } catch (error) {
        console.error('Error fetching designer items:', error)
        setError('Failed to load designer items')
      } finally {
        setLoading((prev) => ({ ...prev, operacoes: false }))
      }
    },
    [supabase, allItems, setLoading, setError, setAllDesignerItems],
  )

  return {
    fetchItems,
    fetchOperacoes,
    fetchDesignerItems,
  }
}
