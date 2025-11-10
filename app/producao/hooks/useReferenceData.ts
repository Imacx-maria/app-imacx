import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LoadingState, Holiday, ClienteOption } from '@/types/producao'

/**
 * Reference Data Hook
 *
 * Manages the fetching of static/reference data used across the production system:
 * - Clientes (clients) from PHC system
 * - Holidays for production planning calendar
 *
 * This data is relatively static and can be cached client-side.
 *
 * @param supabase - Supabase client instance
 * @param setLoading - Loading state setter
 * @param setError - Error state setter
 * @param setClientes - Clientes state setter
 * @param setHolidays - Holidays state setter
 * @returns Object with reference data fetching functions
 */
export function useReferenceData(
  supabase: SupabaseClient,
  setLoading: React.Dispatch<React.SetStateAction<LoadingState>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setClientes: React.Dispatch<React.SetStateAction<ClienteOption[]>>,
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>,
) {
  /**
   * Fetch clientes (clients) from PHC system
   *
   * Retrieves the list of clients from the PHC business system.
   * This is static data that can be cached client-side.
   * Used for client selection and name resolution throughout the app.
   */
  const fetchClientes = useCallback(async () => {
    setLoading((prev) => ({ ...prev, clientes: true }))
    try {
      const { data: clientesData, error } = await supabase
        .schema('phc')
        .from('cl')
        .select('customer_id, customer_name')
        .order('customer_name', { ascending: true })

      if (error) throw error

      if (clientesData) {
        const clienteOptions = clientesData.map((c: any) => ({
          value: c.customer_id.toString(),
          label: c.customer_name,
        }))
        setClientes(clienteOptions)
      }
    } catch (error) {
      console.error('Error fetching clientes:', error)
      setError('Failed to load client data')
    } finally {
      setLoading((prev) => ({ ...prev, clientes: false }))
    }
  }, [supabase, setLoading, setError, setClientes])

  /**
   * Fetch holidays for production planning
   *
   * Retrieves holidays within a 3-month window (1 month back, 2 months forward)
   * for production planning and calendar calculations.
   * Holidays affect delivery dates and production schedules.
   */
  const fetchHolidays = useCallback(async () => {
    try {
      const today = new Date()
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('feriados')
        .select('id, holiday_date, description')
        .gte('holiday_date', startDateStr)
        .lte('holiday_date', endDateStr)
        .order('holiday_date', { ascending: true })

      if (error) {
        console.error('Error fetching holidays:', error)
        return
      }

      if (data) {
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }, [supabase, setHolidays])

  return {
    fetchClientes,
    fetchHolidays,
  }
}
