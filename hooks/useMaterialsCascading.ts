import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export interface MaterialOption {
  value: string
  label: string
}

export interface MaterialData {
  id: string
  material: string | null
  carateristica: string | null
  cor: string | null
  referencia: string | null
  ref_fornecedor: string | null
  tipo_canal: string | null
  valor_m2_custo: number | null
  valor_placa: number | null
  valor_m2: number | null
  qt_palete: number | null
}

export const useMaterialsCascading = () => {
  const [materialsData, setMaterialsData] = useState<MaterialData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize the supabase client to prevent infinite re-renders
  const supabase = useMemo(() => createBrowserClient(), [])

  // Fetch all materials data
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[useMaterialsCascading] Starting fetch...')

      // Try flexible query - match RÍGIDOS with case-insensitive and trim
      const { data, error } = await supabase
        .from('materiais')
        .select(
          'id, material, carateristica, cor, referencia, ref_fornecedor, tipo_canal, valor_m2_custo, valor_placa, valor_m2, qt_palete, tipo',
        )
        .ilike('tipo', 'RÍGIDOS') // Case-insensitive match for RÍGIDOS
        .not('material', 'is', null) // Ensure material field is not null
        .order('material', { ascending: true })

      console.log('[useMaterialsCascading] Query completed:', { 
        hasData: !!data, 
        dataLength: data?.length || 0, 
        hasError: !!error,
        error: error 
      })

      if (error) {
        console.error('[useMaterialsCascading] Supabase error:', error)
        throw error
      }

      if (data) {
        console.log(`[useMaterialsCascading] Fetched ${data.length} materials`)
        console.log('[useMaterialsCascading] Sample materials:', data.slice(0, 5).map(d => d.material))
        console.log('[useMaterialsCascading] Sample tipos:', data.slice(0, 5).map(d => d.tipo))
        setMaterialsData(data)
      } else {
        console.warn('[useMaterialsCascading] No data returned from query')
      }
    } catch (err) {
      console.error('[useMaterialsCascading] Error fetching materials:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Fetch data on hook initialization
  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  // Get unique materials (first level)
  const materialOptions = useMemo((): MaterialOption[] => {
    const uniqueMaterials = new Set<string>()

    materialsData.forEach((item) => {
      if (item.material) {
        // Normalize to uppercase for consistency
        uniqueMaterials.add(item.material.toUpperCase())
      }
    })

    const options = Array.from(uniqueMaterials)
      .sort()
      .map((material) => ({
        value: material,
        label: material,
      }))
    
    console.log(`[useMaterialsCascading] Generated ${options.length} unique material options from ${materialsData.length} records`)
    console.log('[useMaterialsCascading] Material options:', options)
    if (materialsData.length > 0) {
      console.log('[useMaterialsCascading] Full raw data sample:', materialsData.slice(0, 3))
    }
    
    return options
  }, [materialsData])

  // Get characteristics filtered by selected material (second level)
  const getCaracteristicaOptions = useCallback(
    (selectedMaterial?: string): MaterialOption[] => {
      if (!selectedMaterial) return []

      const uniqueCaracteristicas = new Set<string>()

      materialsData
        .filter((item) => item.material?.toUpperCase() === selectedMaterial.toUpperCase())
        .forEach((item) => {
          if (item.carateristica) {
            // Normalize to uppercase for consistency
            uniqueCaracteristicas.add(item.carateristica.toUpperCase())
          }
        })

      return Array.from(uniqueCaracteristicas)
        .sort()
        .map((caracteristica) => ({
          value: caracteristica,
          label: caracteristica,
        }))
    },
    [materialsData],
  )

  // Get colors filtered by selected material and characteristic (third level)
  const getCorOptions = useCallback(
    (
      selectedMaterial?: string,
      selectedCaracteristica?: string,
    ): MaterialOption[] => {
      if (!selectedMaterial) return []

      const uniqueCores = new Set<string>()

      materialsData
        .filter((item) => {
          const materialMatch = item.material?.toUpperCase() === selectedMaterial.toUpperCase()
          const caracteristicaMatch = selectedCaracteristica
            ? item.carateristica?.toUpperCase() === selectedCaracteristica.toUpperCase()
            : true

          return materialMatch && caracteristicaMatch
        })
        .forEach((item) => {
          if (item.cor) {
            // Normalize to uppercase for consistency
            uniqueCores.add(item.cor.toUpperCase())
          }
        })

      return Array.from(uniqueCores)
        .sort()
        .map((cor) => ({
          value: cor,
          label: cor,
        }))
    },
    [materialsData],
  )

  // Get the material ID based on the complete selection
  const getMaterialId = useCallback(
    (
      material?: string,
      caracteristica?: string,
      cor?: string,
    ): string | null => {
      if (!material) return null

      const foundMaterial = materialsData.find((item) => {
        const materialMatch = item.material?.toUpperCase() === material.toUpperCase()
        const caracteristicaMatch = caracteristica
          ? item.carateristica?.toUpperCase() === caracteristica.toUpperCase()
          : true
        const corMatch = cor ? item.cor?.toUpperCase() === cor.toUpperCase() : true

        return materialMatch && caracteristicaMatch && corMatch
      })

      return foundMaterial?.id || null
    },
    [materialsData],
  )

  return {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    materialsData, // Export the raw materials data
    loading,
    error,
    refetch: fetchMaterials,
  }
}

