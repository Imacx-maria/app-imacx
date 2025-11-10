import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Job } from '@/types/producao'

/**
 * Duplicate Validation Hook
 *
 * Provides functions to check for duplicate ORC and FO numbers
 * before creating or updating jobs. Prevents data integrity issues
 * by validating uniqueness across the folhas_obras table.
 *
 * @param supabase - Supabase client instance
 * @returns Object with duplicate checking functions
 */
export function useDuplicateValidation(supabase: SupabaseClient) {
  /**
   * Check if ORC (Orcamento) number already exists
   *
   * @param orcNumber - The ORC number to check
   * @param currentJobId - ID of current job (to exclude from check)
   * @returns Existing job if duplicate found, null otherwise
   */
  const checkOrcDuplicate = useCallback(
    async (orcNumber: string, currentJobId: string): Promise<Job | null> => {
      if (!orcNumber || orcNumber === '') {
        return null
      }

      try {
        let query = supabase
          .from('folhas_obras')
          .select('id, numero_orc, Numero_do_, Trabalho, Nome')
          .eq('numero_orc', orcNumber)

        // Only add the neq filter if currentJobId is not a temp job
        // Temp jobs have string IDs like "temp-xxx"
        if (
          currentJobId &&
          currentJobId.trim() !== '' &&
          !currentJobId.startsWith('temp-')
        ) {
          query = query.neq('id', currentJobId)
        }

        const { data, error } = await query.limit(1)

        if (error) throw error

        return data && data.length > 0
          ? ({
              id: (data as any)[0].id,
              numero_orc: (data as any)[0].numero_orc ?? null,
              numero_fo: (data as any)[0].Numero_do_
                ? String((data as any)[0].Numero_do_)
                : '',
              nome_campanha: (data as any)[0].Trabalho || '',
              cliente: (data as any)[0].Nome || null,
              data_saida: null,
              prioridade: null,
              notas: null,
            } as Job)
          : null
      } catch (error) {
        console.error('Error checking ORC duplicate:', error)
        return null
      }
    },
    [supabase],
  )

  /**
   * Check if FO (Folha de Obra) number already exists
   *
   * @param foNumber - The FO number to check
   * @param currentJobId - ID of current job (to exclude from check)
   * @returns Existing job if duplicate found, null otherwise
   */
  const checkFoDuplicate = useCallback(
    async (foNumber: string, currentJobId: string): Promise<Job | null> => {
      if (!foNumber || foNumber.trim() === '') {
        return null
      }

      try {
        let query = supabase
          .from('folhas_obras')
          .select('id, Numero_do_, numero_orc, Trabalho, Nome')
          .eq('Numero_do_', foNumber.trim())

        // Only add the neq filter if currentJobId is not a temp job
        // Temp jobs have string IDs like "temp-xxx"
        if (
          currentJobId &&
          currentJobId.trim() !== '' &&
          !currentJobId.startsWith('temp-')
        ) {
          query = query.neq('id', currentJobId)
        }

        const { data, error } = await query.limit(1)

        if (error) throw error

        return data && data.length > 0
          ? ({
              id: (data as any)[0].id,
              numero_orc: (data as any)[0].numero_orc ?? null,
              numero_fo: (data as any)[0].Numero_do_
                ? String((data as any)[0].Numero_do_)
                : '',
              nome_campanha: (data as any)[0].Trabalho || '',
              cliente: (data as any)[0].Nome || null,
              data_saida: null,
              prioridade: null,
              notas: null,
            } as Job)
          : null
      } catch (error) {
        console.error('Error checking FO duplicate:', error)
        return null
      }
    },
    [supabase],
  )

  return {
    checkOrcDuplicate,
    checkFoDuplicate,
  }
}
