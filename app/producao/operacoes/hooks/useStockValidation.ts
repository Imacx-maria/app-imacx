import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export interface StockInfo {
  materialId: string
  availableQuantity: number
  unit: string
  isLowStock: boolean
  isOutOfStock: boolean
  stockEntries: any[]
}

export const useStockValidation = () => {
  const [stockInfo, setStockInfo] = useState<Record<string, StockInfo>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient()

  // Get stock information for a specific material
  const getStockInfo = useCallback(async (materialId: string): Promise<StockInfo | null> => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('stocks')
        .select(`
          *,
          materiais(material, cor, tipo)
        `)
        .eq('material_id', materialId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Erro ao buscar estoque: ${error.message}`)
      }

      if (!data || data.length === 0) {
        return null
      }

      // Calculate total available quantity
      const totalAvailable = data.reduce((sum, entry) => {
        return entry.tipo_movimento === 'Entrada' ? sum + entry.quantidade : sum - entry.quantidade
      }, 0)

      // Get the most recent entry for unit information
      const latestEntry = data[0]
      
      // Define low stock threshold (this could be configurable)
      const lowStockThreshold = 10
      
      const stockInfo: StockInfo = {
        materialId,
        availableQuantity: totalAvailable,
        unit: latestEntry.unidade || 'm²',
        isLowStock: totalAvailable <= lowStockThreshold && totalAvailable > 0,
        isOutOfStock: totalAvailable <= 0,
        stockEntries: data
      }

      // Cache the stock info
      setStockInfo(prev => ({ ...prev, [materialId]: stockInfo }))

      return stockInfo
    } catch (err) {
      console.error('Error getting stock info:', err)
      setError(`Erro ao verificar estoque: ${err}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Validate if operation can be performed with current stock
  const validateOperation = useCallback(async (
    materialId: string, 
    requiredQuantity: number
  ): Promise<{ isValid: boolean; message?: string; stockInfo?: StockInfo }> => {
    try {
      const stockInfo = await getStockInfo(materialId)
      
      if (!stockInfo) {
        return {
          isValid: false,
          message: 'Material não encontrado no estoque'
        }
      }

      if (stockInfo.isOutOfStock) {
        return {
          isValid: false,
          message: 'Material em falta no estoque',
          stockInfo
        }
      }

      if (stockInfo.availableQuantity < requiredQuantity) {
        return {
          isValid: false,
          message: `Estoque insuficiente. Disponível: ${stockInfo.availableQuantity} ${stockInfo.unit}`,
          stockInfo
        }
      }

      const remainingAfterOperation = stockInfo.availableQuantity - requiredQuantity
      let message = undefined

      if (remainingAfterOperation <= 0) {
        message = 'Atenção: Operação esgotará o estoque deste material'
      } else if (remainingAfterOperation <= 10) {
        message = `Atenção: Restará apenas ${remainingAfterOperation} ${stockInfo.unit} após a operação`
      }

      return {
        isValid: true,
        message,
        stockInfo
      }
    } catch (err) {
      return {
        isValid: false,
        message: `Erro na validação: ${err}`
      }
    }
  }, [getStockInfo])

  // Get stock info for multiple materials
  const getMultipleStockInfo = useCallback(async (materialIds: string[]) => {
    try {
      setLoading(true)
      setError(null)

      const promises = materialIds.map(id => getStockInfo(id))
      const results = await Promise.all(promises)
      
      const stockInfoMap: Record<string, StockInfo> = {}
      results.forEach((info, index) => {
        if (info) {
          stockInfoMap[materialIds[index]] = info
        }
      })

      setStockInfo(prev => ({ ...prev, ...stockInfoMap }))
      return stockInfoMap
    } catch (err) {
      console.error('Error getting multiple stock info:', err)
      setError(`Erro ao verificar estoques: ${err}`)
      return {}
    } finally {
      setLoading(false)
    }
  }, [getStockInfo])

  // Get low stock alerts
  const getLowStockAlerts = useCallback(async () => {
    try {
      // Get all materials with stock levels
      const { data, error } = await supabase
        .from('materiais')
        .select(`
          id,
          material,
          cor,
          tipo,
          stocks(quantidade, quantidade_disponivel, tipo_movimento, created_at)
        `)

      if (error) {
        throw new Error(`Erro ao buscar alertas de estoque: ${error.message}`)
      }

      if (!data) return []

      const lowStockMaterials = data
        .map(material => {
          if (!material.stocks || material.stocks.length === 0) return null

          // Calculate current stock
          const currentStock = material.stocks.reduce((sum: number, entry: any) => {
            return entry.tipo_movimento === 'Entrada' ? sum + entry.quantidade : sum - entry.quantidade
          }, 0)

          if (currentStock <= 10) {
            return {
              materialId: material.id,
              materialName: `${material.material} ${material.cor}`.trim(),
              currentStock,
              isOutOfStock: currentStock <= 0
            }
          }

          return null
        })
        .filter(Boolean)

      return lowStockMaterials
    } catch (err) {
      console.error('Error getting low stock alerts:', err)
      return []
    }
  }, [supabase])

  // Clear cached stock info
  const clearStockCache = useCallback(() => {
    setStockInfo({})
  }, [])

  // Refresh stock info for a material
  const refreshStockInfo = useCallback(async (materialId: string) => {
    // Remove from cache and fetch fresh data
    setStockInfo(prev => {
      const { [materialId]: removed, ...rest } = prev
      return rest
    })
    return await getStockInfo(materialId)
  }, [getStockInfo])

  return {
    stockInfo,
    loading,
    error,
    getStockInfo,
    validateOperation,
    getMultipleStockInfo,
    getLowStockAlerts,
    clearStockCache,
    refreshStockInfo
  }
}

