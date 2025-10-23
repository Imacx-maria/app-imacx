import { useState, useCallback, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { createBrowserClient } from '@/utils/supabase'
import {
  LogisticaRecord,
  Cliente,
  Transportadora,
  FolhaObra,
  Armazem,
} from '@/types/logistica'

// Maximum size of cache to prevent memory issues
const MAX_CACHE_ENTRIES = 10

// Hook
export function useLogisticaData() {
  // Create Supabase client only once and memoize it
  const supabase = useMemo(() => createBrowserClient(), [])

  // State
  const [loading, setLoading] = useState<boolean>(false)
  const [records, setRecords] = useState<LogisticaRecord[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [armazens, setArmazens] = useState<Armazem[]>([])

  // Use a ref for data cache to preserve it between renders
  // without causing re-renders when it changes
  const dataCacheRef = useRef<Record<string, LogisticaRecord[]>>({})

  // Track cache access order for LRU cache eviction
  const cacheAccessOrderRef = useRef<string[]>([])

  // Function to update cache with LRU eviction policy
  const updateCache = useCallback(
    (dateStr: string, data: LogisticaRecord[]) => {
      // Remove from current position in access order (if exists)
      cacheAccessOrderRef.current = cacheAccessOrderRef.current.filter(
        (date) => date !== dateStr,
      )

      // Add to front (most recently used)
      cacheAccessOrderRef.current.unshift(dateStr)

      // If cache exceeds max size, remove least recently used entry
      if (cacheAccessOrderRef.current.length > MAX_CACHE_ENTRIES) {
        const oldest = cacheAccessOrderRef.current.pop()
        if (oldest && oldest !== dateStr) {
          const { [oldest]: _, ...rest } = dataCacheRef.current
          dataCacheRef.current = rest
        }
      }

      // Update the cache with new data
      dataCacheRef.current[dateStr] = data
    },
    [],
  )

  // Create lookup dictionaries
  const clienteLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    clientes.forEach((cliente) => {
      lookup[cliente.value] = cliente.label
    })
    return lookup
  }, [clientes])

  const transportadoraLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    transportadoras.forEach((transportadora) => {
      lookup[transportadora.value] = transportadora.label
    })
    return lookup
  }, [transportadoras])

  // Utility function to parse a date string as a local date
  const parseDateFromYYYYMMDD = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Fetch logistics data for a specific date - filtering by data_saida in logistica_entregas
  const fetchLogisticaData = useCallback(
    async (date: Date | null) => {
      if (!date) return []
      setLoading(true)
      const dateStr = format(date, 'yyyy-MM-dd')
      try {
        const { data, error } = await supabase
          .from('logistica_entregas')
          .select(
            `
          *,
          items_base!inner (
            id,
            descricao,
            brindes,
            folha_obra_id,
            data_saida,
            folhas_obras (
              id,
              numero_orc,
              numero_fo,
              cliente,
              id_cliente,
              saiu
            )
          )
        `,
          )
          .eq('data_saida', dateStr)
        if (error) throw error
        if (data) {
          // Deduplicate by id
          const unique = Array.from(
            new Map(
              data.map((item: LogisticaRecord) => [item.id, item]),
            ).values(),
          ) as LogisticaRecord[]
          // Ensure key fields are correctly mapped
          const processedRecords = unique.map((record: LogisticaRecord) => {
            // Deep clone to avoid reference issues
            const processedRecord = JSON.parse(JSON.stringify(record))
            // Ensure items_base exists
            if (!processedRecord.items_base) {
              processedRecord.items_base = {
                id: '',
                descricao: '',
                brindes: false,
              }
            }
            // Ensure folhas_obras exists
            if (!processedRecord.items_base.folhas_obras) {
              processedRecord.items_base.folhas_obras = {
                id: '',
                numero_orc: '',
                numero_fo: '',
                cliente: '',
                id_cliente: '',
                saiu: false,
              }
            }
            // Ensure descricao field is populated - prioritize direct field, then items_base
            if (
              !processedRecord.descricao &&
              processedRecord.items_base?.descricao
            ) {
              processedRecord.descricao = processedRecord.items_base.descricao
            }
            return processedRecord
          })
          setRecords(processedRecords)
          setLoading(false)
          return processedRecords
        }
      } catch (error) {
        console.error('Error fetching logistica data:', error)
        setLoading(false)
        return []
      }
      setLoading(false)
      return []
    },
    [supabase],
  )

  // Initialize reference data with better error handling and retry logic
  const fetchReferenceData = useCallback(async () => {
    const MAX_RETRIES = 3
    let retries = 0

    const fetchWithRetry = async () => {
      try {
        // Fetch clientes
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome_cl, morada, codigo_pos')

        if (clientesError) throw clientesError

        if (clientesData) {
          setClientes(
            clientesData.map((c: any) => ({
              value: c.id,
              label: c.nome_cl,
              morada: c.morada,
              codigo_pos: c.codigo_pos,
            })),
          )
        }

        // Fetch transportadoras
        const { data: transportadorasData, error: transportadorasError } =
          await supabase.from('transportadora').select('id, name')

        if (transportadorasError) throw transportadorasError

        if (transportadorasData) {
          setTransportadoras(
            transportadorasData.map((t: any) => ({
              value: t.id,
              label: t.name,
            })),
          )
        }

        // Fetch armazens
        const { data: armazensData, error: armazensError } = await supabase
          .from('armazens')
          .select('id, nome_arm, morada, codigo_pos')

        if (armazensError) throw armazensError

        if (armazensData) {
          setArmazens(
            armazensData.map((a: any) => ({
              value: a.id,
              label: a.nome_arm,
              morada: a.morada,
              codigo_pos: a.codigo_pos,
            })),
          )
        }

        return true
      } catch (error) {
        console.error(
          `Error fetching reference data (attempt ${retries + 1}):`,
          error,
        )

        if (retries < MAX_RETRIES) {
          retries++
          // Exponential backoff for retries (300ms, 900ms, 2700ms)
          const delay = 300 * Math.pow(3, retries - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return fetchWithRetry()
        }

        return false
      }
    }

    return fetchWithRetry()
  }, [supabase])

  // Re-fetch a single row and update state
  const refetchRow = useCallback(
    async (rowId: string, currentDate: Date | null) => {
      try {
        // First, get current state of the row to preserve any fields in case of issues
        const currentRow = records.find((r) => r.id === rowId)

        const { data, error } = await supabase
          .from('logistica_entregas')
          .select(
            `
          *, 
          items_base (
            id, 
            descricao, 
            brindes, 
            folha_obra_id,
            data_saida,
            folhas_obras (
              id, 
              numero_orc, 
              numero_fo, 
              cliente, 
              id_cliente,
              saiu
            )
          )
        `,
          )
          .eq('id', rowId)
          .single()

        if (error) throw error

        if (data) {
          // Process the row to ensure all expected fields exist
          const processedRow = { ...data }

          // Ensure items_base exists
          if (!processedRow.items_base) {
            processedRow.items_base = currentRow?.items_base || {
              id: '',
              descricao: '',
              brindes: false,
            }
          }

          // Preserve item description if it exists in current data but is missing in fetched data
          if (
            currentRow?.items_base?.descricao &&
            !processedRow.items_base.descricao
          ) {
            processedRow.items_base.descricao = currentRow.items_base.descricao
          }

          // Ensure descricao field is populated - prioritize direct field, then items_base
          if (!processedRow.descricao && processedRow.items_base?.descricao) {
            processedRow.descricao = processedRow.items_base.descricao
          }

          // Ensure folhas_obras exists
          if (!processedRow.items_base.folhas_obras) {
            processedRow.items_base.folhas_obras = currentRow?.items_base
              ?.folhas_obras || {
              id: '',
              numero_orc: '',
              numero_fo: '',
              cliente: '',
              id_cliente: '',
              saiu: false,
            }
          }

          // Update records in state
          setRecords((prevRecords) =>
            prevRecords.map((r) => {
              if (r.id === rowId) {
                // Use the updated record but preserve any fields that might have been lost
                return processedRow as LogisticaRecord
              }
              return r
            }),
          )

          // Update cache if we have a date
          if (currentDate) {
            const dateStr = format(currentDate, 'yyyy-MM-dd')
            if (dataCacheRef.current[dateStr]) {
              dataCacheRef.current[dateStr] = dataCacheRef.current[dateStr].map(
                (r) => (r.id === rowId ? (processedRow as LogisticaRecord) : r),
              )
            }
          }

          return processedRow
        }

        return null
      } catch (error) {
        console.error('Error refetching row:', error)
        return null
      }
    },
    [supabase, records],
  )

  // Update a single field in logistica_entregas
  const updateLogisticaField = useCallback(
    async (
      rowId: string,
      field: string,
      value: any,
      currentDate: Date | null,
    ) => {
      try {
        // Handle type conversion for numeric fields
        let processedValue = value

        // Convert undefined to null for all fields
        if (value === undefined) {
          processedValue = null
        }

        // For guia field which expects integer, convert empty string to null
        if (field === 'guia') {
          if (value === '' || value === null || value === undefined) {
            processedValue = null
          } else if (typeof value === 'string') {
            // If not empty, ensure it's a valid integer
            const parsedValue = parseInt(value.trim())
            if (!isNaN(parsedValue)) {
              processedValue = parsedValue
            } else {
              // For non-numeric input, use null to prevent database errors
              processedValue = null
            }
          }

          console.log(`Updating guia field with value:`, {
            rowId,
            original: value,
            processed: processedValue,
          })
        }

        const { error } = await supabase
          .from('logistica_entregas')
          .update({ [field]: processedValue })
          .eq('id', rowId)

        if (error) {
          console.error(`Error updating ${field}:`, error)
          throw error
        }

        // Update local data if we have a date context
        if (currentDate) {
          console.log(`Refetching row ${rowId} after updating ${field}`)
          await refetchRow(rowId, currentDate)

          // Also clear cache to force fresh data on next load
          const dateStr = format(currentDate, 'yyyy-MM-dd')
          if (dataCacheRef.current[dateStr]) {
            console.log(`Clearing cache for ${dateStr} to ensure fresh data`)
            delete dataCacheRef.current[dateStr]
          }
        }

        return true
      } catch (error) {
        console.error(`Error updating ${field}:`, error)
        return false
      }
    },
    [supabase, refetchRow],
  )

  // Update a field in folhas_obras
  const updateFolhaObraField = useCallback(
    async (
      folhaObraId: string,
      field: string,
      value: any,
      currentDate: Date | null,
    ) => {
      if (!folhaObraId) return false

      try {
        // Handle type conversion for numeric fields
        let processedValue = value

        // For numero_orc field which expects integer
        if (
          field === 'numero_orc' &&
          (value === '' || value === null || value === undefined)
        ) {
          processedValue = null
        } else if (field === 'numero_orc' && typeof value === 'string') {
          // If not empty, ensure it's a valid integer
          const parsedValue = parseInt(value)
          if (!isNaN(parsedValue)) {
            processedValue = parsedValue
          } else {
            throw new Error(`Invalid value for ${field}: must be a number`)
          }
        }

        // For numero_fo - now a TEXT field (per docs)
        if (field === 'numero_fo') {
          // Convert empty values to null
          if (value === '' || value === null || value === undefined) {
            processedValue = null
          } else {
            processedValue = String(value).trim() // Ensure it's a string and trim whitespace

            // Check if another record already has this FO number
            const { data: existingData, error: checkError } = await supabase
              .from('folhas_obras')
              .select('id')
              .eq('numero_fo', processedValue)
              .neq('id', folhaObraId) // Exclude current record

            if (checkError) throw checkError

            if (existingData && existingData.length > 0) {
              return false
            }
          }
        }

        const { error } = await supabase
          .from('folhas_obras')
          .update({ [field]: processedValue })
          .eq('id', folhaObraId)

        if (error) throw error

        // Update records in state
        setRecords((prevRecords) =>
          prevRecords.map((record) => {
            if (
              record.items_base?.folha_obra_id === folhaObraId ||
              record.items_base?.folhas_obras?.id === folhaObraId
            ) {
              // Create a deep clone to avoid reference issues
              const updatedRecord = JSON.parse(JSON.stringify(record))

              // Ensure the path exists
              if (!updatedRecord.items_base) {
                updatedRecord.items_base = {}
              }

              if (!updatedRecord.items_base.folhas_obras) {
                updatedRecord.items_base.folhas_obras = {}
              }

              // Update the field
              updatedRecord.items_base.folhas_obras[field] = processedValue

              return updatedRecord
            }
            return record
          }),
        )

        // Update cache if we have a date
        if (currentDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd')
          if (dataCacheRef.current[dateStr]) {
            dataCacheRef.current[dateStr] = dataCacheRef.current[dateStr].map(
              (record) => {
                if (
                  record.items_base?.folha_obra_id === folhaObraId ||
                  record.items_base?.folhas_obras?.id === folhaObraId
                ) {
                  // Create a deep clone to avoid reference issues
                  const updatedRecord = JSON.parse(JSON.stringify(record))

                  // Ensure the path exists
                  if (!updatedRecord.items_base) {
                    updatedRecord.items_base = {}
                  }

                  if (!updatedRecord.items_base.folhas_obras) {
                    updatedRecord.items_base.folhas_obras = {}
                  }

                  // Update the field
                  updatedRecord.items_base.folhas_obras[field] = processedValue

                  return updatedRecord
                }
                return record
              },
            )
          }
        }

        return true
      } catch (error) {
        console.error(`Error updating folha obra ${field}:`, error)
        return false
      }
    },
    [supabase],
  )

  // Update a field in items_base
  const updateItemBaseField = useCallback(
    async (
      itemId: string,
      field: string,
      value: any,
      currentDate: Date | null,
    ) => {
      if (!itemId) return false

      try {
        const { error } = await supabase
          .from('items_base')
          .update({ [field]: value })
          .eq('id', itemId)

        if (error) throw error

        // Update local records
        setRecords((prevRecords) =>
          prevRecords.map((record) => {
            if (record.items_base?.id === itemId) {
              // Create a deep clone to avoid reference issues
              const updatedRecord = JSON.parse(JSON.stringify(record))

              // Update the field
              updatedRecord.items_base[field] = value

              return updatedRecord
            }
            return record
          }),
        )

        // Update cache if we have a date
        if (currentDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd')
          if (dataCacheRef.current[dateStr]) {
            dataCacheRef.current[dateStr] = dataCacheRef.current[dateStr].map(
              (record) => {
                if (record.items_base?.id === itemId) {
                  // Create a deep clone to avoid reference issues
                  const updatedRecord = JSON.parse(JSON.stringify(record))

                  // Update the field
                  updatedRecord.items_base[field] = value

                  return updatedRecord
                }
                return record
              },
            )
          }
        }

        return true
      } catch (error) {
        console.error(`Error updating item base ${field}:`, error)
        return false
      }
    },
    [supabase],
  )

  // Delete a row
  const deleteLogisticaRow = useCallback(
    async (rowId: string, currentDate: Date | null) => {
      try {
        const { error } = await supabase
          .from('logistica_entregas')
          .delete()
          .eq('id', rowId)

        if (error) throw error

        // Update local records
        setRecords((prevRecords) => prevRecords.filter((r) => r.id !== rowId))

        // Update cache if we have a date
        if (currentDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd')
          if (dataCacheRef.current[dateStr]) {
            dataCacheRef.current[dateStr] = dataCacheRef.current[
              dateStr
            ].filter((r) => r.id !== rowId)
          }
        }

        return true
      } catch (error) {
        console.error('Error deleting row:', error)
        return false
      }
    },
    [supabase],
  )

  // Duplicate a row - create a new logistica_entregas record for the same item
  const duplicateLogisticaRow = useCallback(
    async (row: LogisticaRecord, currentDate: Date | null) => {
      try {
        const itemId = row.items_base?.id
        if (!itemId) {
          console.error('Cannot duplicate row: missing items_base.id', row)
          return false
        }

        // Create a new logistics entry with the same data but clear GUIA for independent tracking
        const newLogisticaData = {
          item_id: itemId,
          descricao: row.items_base?.descricao || row.descricao, // Store item description directly
          local_recolha: row.local_recolha,
          guia: null, // Clear GUIA so each duplicated entry can have its own unique GUIA
          transportadora: row.transportadora,
          contacto: row.contacto,
          telefone: row.telefone,
          // Use logistics quantity if set, otherwise fall back to items_base quantity
          quantidade:
            row.quantidade !== null
              ? row.quantidade
              : row.items_base?.quantidade || null,
          notas: row.notas,
          local_entrega: row.local_entrega,
          contacto_entrega: row.contacto_entrega,
          telefone_entrega: row.telefone_entrega,
          id_local_entrega: row.id_local_entrega,
          id_local_recolha: row.id_local_recolha,
          data: currentDate
            ? format(currentDate, 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
          is_entrega: true,
        }

        console.log('Creating duplicate logistics entry:', newLogisticaData)

        const { data: newRecord, error } = await supabase
          .from('logistica_entregas')
          .insert(newLogisticaData)
          .select(
            `
          *,
          items_base!inner (
            id,
            descricao,
            brindes,
            folha_obra_id,
            data_saida,
            folhas_obras (
              id,
              numero_orc,
              numero_fo,
              cliente,
              id_cliente,
              saiu
            )
          )
        `,
          )
          .single()

        if (error) throw error

        if (newRecord) {
          // Process the new record similar to fetchLogisticaData
          const processedRecord = JSON.parse(JSON.stringify(newRecord))

          // Ensure items_base exists
          if (!processedRecord.items_base) {
            processedRecord.items_base = {
              id: '',
              descricao: '',
              brindes: false,
            }
          }

          // Ensure folhas_obras exists
          if (!processedRecord.items_base.folhas_obras) {
            processedRecord.items_base.folhas_obras = {
              id: '',
              numero_orc: '',
              numero_fo: '',
              cliente: '',
              id_cliente: '',
              saiu: false,
            }
          }

          // Add to local records
          setRecords((prevRecords) => [...prevRecords, processedRecord])

          // Clear cache and force fresh data on next load
          if (currentDate) {
            const dateStr = format(currentDate, 'yyyy-MM-dd')
            console.log(`Clearing cache for ${dateStr} after duplicating row`)
            delete dataCacheRef.current[dateStr]

            // Force immediate refresh to ensure we have the latest data
            await fetchLogisticaData(currentDate)
          }
        }

        return true
      } catch (error) {
        console.error('Error duplicating row:', error)
        setLoading(false)
        return false
      }
    },
    [supabase, fetchLogisticaData],
  )

  return {
    loading,
    records,
    clientes,
    transportadoras,
    armazens,
    clienteLookup,
    transportadoraLookup,
    fetchLogisticaData,
    fetchReferenceData,
    refetchRow,
    updateLogisticaField,
    updateFolhaObraField,
    updateItemBaseField,
    deleteLogisticaRow,
    duplicateLogisticaRow,
  }
}
