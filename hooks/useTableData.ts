import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'

export interface OperatorOption {
  value: string
  label: string
}

export interface MachineOption {
  value: string
  label: string
}

export const useTableData = () => {
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [machines, setMachines] = useState<MachineOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient()

  // Fetch operators with specific role names
  const fetchOperators = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id, 
          first_name, 
          last_name,
          roles!profiles_role_id_fkey (
            name
          )
        `,
        )
        .in('role_id', [
          '968afe0b-0b14-46b2-9269-4fc9f120bbfa',
          '2e18fb9d-52ef-4216-90ea-699372cd5a87',
        ])
        .order('first_name', { ascending: true })

      if (error) throw error

      if (data) {
        const operatorOptions = data.map((profile) => ({
          value: profile.id,
          label: profile.first_name,
        }))
        setOperators(operatorOptions)
      }
    } catch (err) {
      console.error('Error fetching operators:', err)
      setError('Erro ao carregar operadores')
    }
  }, [supabase])

  // Fetch machines from maquinas_operacao table
  const fetchMachines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('maquinas_operacao')
        .select('id, nome_maquina')
        .eq('ativa', true)
        .order('nome_maquina', { ascending: true })

      if (error) throw error

      if (data) {
        const machineOptions = data.map((machine) => ({
          value: machine.id,
          label: machine.nome_maquina,
        }))
        setMachines(machineOptions)
      }
    } catch (err) {
      console.error('Error fetching machines:', err)
      setError('Erro ao carregar máquinas')
    }
  }, [supabase])

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([fetchOperators(), fetchMachines()])
    } catch (err) {
      console.error('Error loading table data:', err)
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [fetchOperators, fetchMachines])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    operators,
    machines,
    loading,
    error,
    refetch: loadData,
  }
}

