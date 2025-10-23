import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export interface ComplexidadeOption {
  value: string
  label: string
}

export const useComplexidades = () => {
  const [complexidades, setComplexidades] = useState<ComplexidadeOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchController = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchComplexidades = async () => {
      // Cancel any in-flight request
      if (fetchController.current) {
        fetchController.current.abort()
      }

      // Create new controller for this request
      fetchController.current = new AbortController()

      try {
        const supabase = createBrowserClient()
        const { data, error } = await supabase
          .from('complexidade')
          .select('id, grau')
          .order('grau', { ascending: true })
          .abortSignal(fetchController.current.signal)

        if (error) throw error

        if (data && !fetchController.current.signal.aborted) {
          const options = data.map((c) => ({
            value: c.grau,
            label: c.grau,
          }))
          setComplexidades(options)
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error fetching complexidades:', error)
          setError(error)
        }
      } finally {
        if (!fetchController.current?.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchComplexidades()

    return () => {
      if (fetchController.current) {
        fetchController.current.abort()
      }
    }
  }, [])

  return { complexidades, isLoading, error }
}

