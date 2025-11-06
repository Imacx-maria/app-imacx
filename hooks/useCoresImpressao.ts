import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export interface CoreOption {
  value: string
  label: string
}

export const useCoresImpressao = () => {
  const [cores, setCores] = useState<CoreOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCores = async () => {
      try {
        setLoading(true)
        const supabase = createBrowserClient()

        console.log('🎨 Fetching cores from database...')
        const { data, error } = await supabase
          .from('cores_impressao')
          .select('n_cores')
          .order('n_cores', { ascending: true })

        if (error) {
          console.error('❌ Error fetching cores:', error)
          throw error
        }

        console.log('✅ Cores data received:', data)

        if (data) {
          const coreOptions = data.map((item) => ({
            value: item.n_cores,
            label: item.n_cores,
          }))
          console.log('✅ Cores options mapped:', coreOptions)
          setCores(coreOptions)
        }
      } catch (err) {
        console.error('❌ Error in fetchCores:', err)
        setError('Erro ao carregar cores')
      } finally {
        setLoading(false)
      }
    }

    fetchCores()
  }, [])

  return {
    cores,
    loading,
    error,
  }
}
