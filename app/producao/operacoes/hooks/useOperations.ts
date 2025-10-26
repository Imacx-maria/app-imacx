import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export const useOperations = () => {
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<any>({})

  const supabase = createBrowserClient()

  // Fetch operations with all related data
  const fetchOperations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch items ready for production operations
      let query = supabase
        .from('items_base')
        .select(
          `
          *,
          folhas_obras!inner(numero_fo, numero_orc, nome_campanha, cliente),
          designer_items!inner(paginacao),
          logistica_entregas(concluido)
        `,
        )
        .eq('designer_items.paginacao', true)
        .not('folhas_obras.numero_orc', 'is', null)
        .neq('folhas_obras.numero_orc', 0)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.dateFrom) {
        query = query.gte('data_operacao', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('data_operacao', filters.dateTo)
      }
      if (filters.foNumber) {
        query = query.ilike('folhas_obras.numero_fo', `%${filters.foNumber}%`)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.operatorId) {
        query = query.eq('operador_id', filters.operatorId)
      }

      const { data, error } = await query

      if (error) throw error
      if (data) {
        // Filter for items where logistics is not completed (concluido is null or false)
        const filteredData = data.filter((item) => {
          const logisticaEntregas = item.logistica_entregas
          if (!logisticaEntregas || logisticaEntregas.length === 0) {
            // No logistics entries - item is ready for production
            return true
          }

          // Check if all logistics entries are not completed (null or false)
          return logisticaEntregas.every((entrega: any) => {
            return entrega.concluido === null || entrega.concluido === false
          })
        })

        // Fetch corresponding producao_operacoes data to merge with items
        const itemIds = filteredData.map((item) => item.id)

        if (itemIds.length > 0) {
          const { data: operacoesData } = await supabase
            .from('producao_operacoes')
            .select(
              'item_id, operador_id, maquina, material_id, num_placas_print, num_placas_corte, observacoes, no_interno',
            )
            .in('item_id', itemIds)

          // Merge the production operations data with items data
          const mergedData = filteredData.map((item) => {
            const operacao = operacoesData?.find((op) => op.item_id === item.id)
            return {
              ...item,
              // Add production operation fields to the item
              operador_id: operacao?.operador_id,
              maquina: operacao?.maquina,
              material_id: operacao?.material_id,
              num_placas_print: operacao?.num_placas_print,
              num_placas_corte: operacao?.num_placas_corte,
              observacoes: operacao?.observacoes,
              no_interno: operacao?.no_interno,
            }
          })

          setOperations(mergedData)
        } else {
          setOperations(filteredData)
        }
      }
    } catch (err) {
      console.error('Error fetching operations:', err)
      setError('Erro ao carregar operações')
    } finally {
      setLoading(false)
    }
  }, [supabase, filters])

  // Create new operation
  const createOperation = useCallback(
    async (operationData: any) => {
      try {
        // First, check stock availability
        const { data: stockData, error: stockError } = await supabase
          .from('stocks')
          .select('quantidade_disponivel, id')
          .eq('material_id', operationData.material_id)
          .eq('tipo_movimento', 'Entrada')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (stockError || !stockData) {
          throw new Error('Material não encontrado no estoque')
        }

        if (
          stockData.quantidade_disponivel <
          operationData.quantidade_material_usado
        ) {
          throw new Error(
            `Estoque insuficiente. Disponível: ${stockData.quantidade_disponivel}`,
          )
        }

        // Create the operation
        const { data: operationResult, error: operationError } = await supabase
          .from('producao_operacoes')
          .insert([
            {
              ...operationData,
              status: 'Em_Curso',
              concluido: false,
              num_placas_print: operationData.maquina_impressao_id ? 1 : 0,
              num_placas_corte: operationData.maquina_corte_id ? 1 : 0,
              desperdicio: operationData.desperdicio || 0,
            },
          ])
          .select()
          .single()

        if (operationError) {
          throw new Error(`Erro ao criar operação: ${operationError.message}`)
        }

        // Create stock consumption record
        const newAvailableQuantity =
          stockData.quantidade_disponivel -
          operationData.quantidade_material_usado

        const { data: stockConsumption, error: stockConsumptionError } =
          await supabase
            .from('stocks')
            .insert([
              {
                material_id: operationData.material_id,
                quantidade: -operationData.quantidade_material_usado,
                quantidade_disponivel: newAvailableQuantity,
                tipo_movimento: 'Saída',
                ref_interna: `OP-${operationData.no_interno}`,
                notas: `Consumo para operação ${operationData.no_interno}`,
                data: operationData.data_operacao,
              },
            ])
            .select()
            .single()

        if (stockConsumptionError) {
          // Rollback the operation if stock consumption fails
          await supabase
            .from('producao_operacoes')
            .delete()
            .eq('id', operationResult.id)
          throw new Error(
            `Erro ao consumir estoque: ${stockConsumptionError.message}`,
          )
        }

        // Update the operation with the stock consumption reference
        await supabase
          .from('producao_operacoes')
          .update({ stock_consumido_id: stockConsumption.id })
          .eq('id', operationResult.id)

        // Refresh the operations list
        await fetchOperations()

        return operationResult
      } catch (err) {
        console.error('Error creating operation:', err)
        throw err
      }
    },
    [supabase, fetchOperations],
  )

  // Update operation
  const updateOperation = useCallback(
    async (id: string, updates: any) => {
      try {
        const { data, error } = await supabase
          .from('producao_operacoes')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error(`Erro ao atualizar operação: ${error.message}`)
        }

        // Update local state optimistically
        setOperations((prev) =>
          prev.map((op) => (op.id === id ? { ...op, ...updates } : op)),
        )

        return data
      } catch (err) {
        console.error('Error updating operation:', err)
        throw err
      }
    },
    [supabase],
  )

  // Complete operation
  const completeOperation = useCallback(
    async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('producao_operacoes')
          .update({
            concluido: true,
            status: 'Concluído',
            data_conclusao: new Date().toISOString(),
            hora_fim: new Date().toTimeString().slice(0, 8),
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error(`Erro ao concluir operação: ${error.message}`)
        }

        // Update local state
        setOperations((prev) =>
          prev.map((op) =>
            op.id === id
              ? {
                  ...op,
                  concluido: true,
                  status: 'Concluído',
                  data_conclusao: data.data_conclusao,
                  hora_fim: data.hora_fim,
                }
              : op,
          ),
        )

        return data
      } catch (err) {
        console.error('Error completing operation:', err)
        throw err
      }
    },
    [supabase],
  )

  // Delete operation
  const deleteOperation = useCallback(
    async (id: string) => {
      try {
        // Get the operation data first to potentially reverse stock consumption
        const { data: operation, error: fetchError } = await supabase
          .from('producao_operacoes')
          .select('stock_consumido_id, quantidade_material_usado, material_id')
          .eq('id', id)
          .single()

        if (fetchError) {
          throw new Error(`Erro ao buscar operação: ${fetchError.message}`)
        }

        // Delete the operation
        const { error: deleteError } = await supabase
          .from('producao_operacoes')
          .delete()
          .eq('id', id)

        if (deleteError) {
          throw new Error(`Erro ao excluir operação: ${deleteError.message}`)
        }

        // If there was stock consumption, we might want to reverse it
        // (This is a business decision - for now we'll keep the stock record for audit trail)

        // Update local state
        setOperations((prev) => prev.filter((op) => op.id !== id))
      } catch (err) {
        console.error('Error deleting operation:', err)
        throw err
      }
    },
    [supabase],
  )

  // Update filters
  const updateFilters = useCallback((newFilters: any) => {
    setFilters((prev: any) => ({ ...prev, ...newFilters }))
  }, [])

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  // Set up real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('production-operations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao_operacoes',
        },
        () => {
          // Refresh operations when changes occur
          fetchOperations()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchOperations])

  // Initial load and filter changes
  useEffect(() => {
    fetchOperations()
  }, [fetchOperations])

  return {
    operations,
    loading,
    error,
    filters,
    createOperation,
    updateOperation,
    completeOperation,
    deleteOperation,
    updateFilters,
    clearFilters,
    refetch: fetchOperations,
  }
}

