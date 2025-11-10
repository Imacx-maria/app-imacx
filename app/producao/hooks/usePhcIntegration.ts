import { useCallback, MutableRefObject } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PhcFoHeader,
  ClienteOption,
  Job,
  Item,
} from '@/types/producao'

/**
 * PHC Integration Hook
 *
 * Handles all PHC (business system) integration logic including:
 * - Fetching FO/ORC headers from PHC
 * - Resolving client names
 * - Importing PHC BI lines to create items
 * - Prefilling and inserting new jobs from FO numbers
 *
 * @param supabase - Supabase client instance
 * @param clientes - List of available clients
 * @param foImportsInProgress - Ref to track ongoing FO imports (prevents duplicates)
 * @param setAllItems - State setter for all items
 * @param setJobs - State setter for jobs
 * @param setOpenId - State setter for drawer open ID
 */
export function usePhcIntegration(
  supabase: SupabaseClient,
  clientes: ClienteOption[],
  foImportsInProgress: MutableRefObject<Set<string>>,
  setAllItems: React.Dispatch<React.SetStateAction<Item[]>>,
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>,
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>,
) {
  /**
   * Fetch PHC header data by FO (Folha de Obra) number
   */
  const fetchPhcHeaderByFo = useCallback(
    async (foNumber: string): Promise<PhcFoHeader | null> => {
      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('folha_obra_with_orcamento')
          .select(
            'folha_obra_id, folha_obra_number, orcamento_number, nome_trabalho, observacoes, customer_id, folha_obra_date',
          )
          .eq('folha_obra_number', foNumber.trim())
          .order('folha_obra_date', { ascending: false })
          .limit(1)

        console.log('📊 PHC Query Result:', {
          foNumber: foNumber.trim(),
          data,
          error,
          dataLength: data?.length,
          firstRow: data?.[0]
        })

        if (error) throw error

        if (!data || data.length === 0) {
          console.warn('⚠️ No PHC data found for FO:', foNumber.trim())
          return null
        }

        console.log('✅ PHC Header found:', data[0])
        return data[0] as PhcFoHeader
      } catch (e) {
        console.error('Error fetching PHC header by FO:', e)
        return null
      }
    },
    [supabase],
  )

  /**
   * Fetch PHC header data by ORC (Orcamento) number
   */
  const fetchPhcHeaderByOrc = useCallback(
    async (orcNumber: string): Promise<PhcFoHeader | null> => {
      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('folha_obra_with_orcamento')
          .select(
            'folha_obra_id, folha_obra_number, orcamento_number, nome_trabalho, observacoes, customer_id, folha_obra_date',
          )
          .eq('orcamento_number', orcNumber)
          .order('folha_obra_date', { ascending: false })
          .limit(1)

        console.log('📊 PHC Query Result (ORC):', {
          orcNumber,
          data,
          error,
          dataLength: data?.length,
          firstRow: data?.[0]
        })

        if (error) throw error

        if (!data || data.length === 0) {
          console.warn('⚠️ No PHC data found for ORC:', orcNumber)
          return null
        }

        console.log('✅ PHC Header found (ORC):', data[0])
        return data[0] as PhcFoHeader
      } catch (e) {
        console.error('Error fetching PHC header by ORC:', e)
        return null
      }
    },
    [supabase],
  )

  /**
   * Resolve client name from customer ID
   * First checks local clientes cache, then queries PHC if not found
   */
  const resolveClienteName = useCallback(
    async (
      customerId: number | null | undefined,
    ): Promise<{ id_cliente: string | null; cliente: string }> => {
      console.log('👤 Resolving client:', { customerId, clientes_loaded: clientes.length })

      if (customerId === null || customerId === undefined) {
        return { id_cliente: null, cliente: '' }
      }

      const idStr = customerId.toString()
      const found = clientes.find((c) => c.value === idStr)

      if (found) {
        const result = { id_cliente: idStr, cliente: found.label }
        console.log('✅ Client resolved from cache:', result)
        return result
      }

      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('cl')
          .select('customer_name')
          .eq('customer_id', customerId)
          .limit(1)

        if (!error && data && data.length > 0) {
          const result = { id_cliente: idStr, cliente: data[0].customer_name }
          console.log('✅ Client resolved from PHC:', result)
          return result
        }
      } catch (e) {
        console.warn('Could not resolve customer name from PHC:', e)
      }

      console.log('⚠️ Client not found, returning empty:', { customerId })
      return { id_cliente: idStr, cliente: '' }
    },
    [clientes, supabase],
  )

  /**
   * Import PHC BI (Budget Items) lines for a Folha de Obra
   * Creates items, designer_items, and logistica_entregas entries
   */
  const importPhcLinesForFo = useCallback(
    async (
      phcFolhaObraId: string,
      newJobId: string,
      folhaObraNumber?: string | null,
    ) => {
      try {
        // Trim the document_id to remove trailing spaces (common issue in PHC data)
        const trimmedDocumentId = phcFolhaObraId?.trim() || phcFolhaObraId
        console.log('🔍 Querying PHC BI with document_id:', { original: phcFolhaObraId, trimmed: trimmedDocumentId })

        const { data: lines, error } = await supabase
          .schema('phc')
          .from('bi')
          .select('line_id, document_id, description, quantity, item_reference')
          .eq('document_id', trimmedDocumentId)
          .gt('quantity', 0)

        if (error) throw error

        console.log('✅ PHC BI query returned:', lines?.length || 0, 'lines')

        if (!lines || lines.length === 0) {
          console.warn('⚠️ No items found in PHC BI for document_id:', trimmedDocumentId)
          return
        }

        // Prepare items_base rows
        const rows = lines.map((l: any) => ({
          folha_obra_id: newJobId,
          descricao: l.description || '',
          codigo: l.item_reference || null,
          quantidade:
            l.quantity !== null && l.quantity !== undefined
              ? Math.round(Number(l.quantity))
              : null,
          brindes: false,
        }))

        // Insert into items_base
        console.log('📥 Inserting', rows.length, 'items from PHC bi lines')
        const { data: inserted, error: insErr } = await supabase
          .from('items_base')
          .insert(rows)
          .select('id, folha_obra_id, descricao, codigo, quantidade, brindes')

        if (insErr) {
          console.error('❌ Error inserting items_base:', insErr)
          throw insErr
        }

        console.log('✅ Inserted', inserted?.length || 0, 'items into items_base')

        // Create designer_items and logistica_entregas for each inserted item
        if (inserted && inserted.length > 0) {
          // Designer items
          console.log('🎨 Creating designer_items entries for', inserted.length, 'items')
          const designerRows = inserted.map((item: any) => ({
            item_id: item.id,
            em_curso: true,
            duvidas: false,
            maquete_enviada1: false,
            paginacao: false,
          }))

          const { data: designerInserted, error: designerErr } = await supabase
            .from('designer_items')
            .insert(designerRows)
            .select('*')

          if (designerErr) {
            console.error('❌ Error inserting designer_items:', designerErr)
          } else {
            console.log('✅ Created', designerInserted?.length || 0, 'designer_items entries')
          }

          // Logistica items
          console.log('🚚 Creating logistica_entregas entries for', inserted.length, 'items')
          const logisticaRows = inserted.map((item: any) => ({
            item_id: item.id,
            descricao: item.descricao || '',
            quantidade: item.quantidade || null,
            data: new Date().toISOString().split('T')[0],
            is_entrega: true,
            id_local_recolha: null,  // Explicitly null to avoid FK constraint violation
            id_local_entrega: null,  // Explicitly null to avoid FK constraint violation
          }))

          const { data: logisticaInserted, error: logisticaErr } = await supabase
            .from('logistica_entregas')
            .insert(logisticaRows)
            .select('*')

          if (logisticaErr) {
            console.error('❌ Error inserting logistica_entregas:', logisticaErr)
          } else {
            console.log('✅ Created', logisticaInserted?.length || 0, 'logistica_entregas entries')
          }
        }

        // Fetch authoritative list for this job and update state
        const { data: fetchedItems, error: fetchErr } = await supabase
          .from('items_base')
          .select('id, folha_obra_id, descricao, codigo, quantidade, brindes')
          .eq('folha_obra_id', newJobId)

        if (!fetchErr && fetchedItems) {
          setAllItems((prev) => {
            const withoutJob = prev.filter((i) => i.folha_obra_id !== newJobId)
            const mapped = fetchedItems.map((it: any) => ({
              id: it.id,
              folha_obra_id: it.folha_obra_id,
              descricao: it.descricao ?? '',
              codigo: it.codigo ?? '',
              quantidade: it.quantidade ?? null,
              paginacao: false,
              brindes: it.brindes ?? false,
              concluido: false,
            }))
            return [...withoutJob, ...mapped]
          })
        }

        // Mirror minimal data into public.folhas_obras_linhas for FO reporting
        if (folhaObraNumber) {
          const foInt = parseInt(String(folhaObraNumber), 10)

          if (!Number.isNaN(foInt)) {
            // Avoid duplicates if this import is triggered multiple times
            try {
              const { error: delErr } = await supabase
                .schema('public')
                .from('folhas_obras_linhas')
                .delete()
                .eq('Numero_do_', foInt)

              if (delErr) {
                console.warn('Warning deleting existing linhas for FO:', foInt, delErr)
              }
            } catch (delEx) {
              console.warn('Delete exception folhas_obras_linhas for FO:', foInt, delEx)
            }

            const linhasRows = lines.map((l: any) => ({
              Numero_do_: foInt,
              Quant_:
                l.quantity !== null && l.quantity !== undefined
                  ? Math.round(Number(l.quantity))
                  : null,
            }))

            try {
              const { data: linhasInserted, error: linhasErr } = await supabase
                .schema('public')
                .from('folhas_obras_linhas')
                .insert(linhasRows)
                .select('Numero_do_, Quant_')

              if (linhasErr) {
                console.warn('Warning inserting folhas_obras_linhas:', linhasErr)
              } else {
                console.log('Mirrored folhas_obras_linhas rows:', linhasInserted?.length || 0)
              }
            } catch (insEx) {
              console.warn('Insert exception folhas_obras_linhas:', insEx)
            }
          }
        }
      } catch (e) {
        console.error('Error importing PHC BI lines:', e)
      }
    },
    [supabase, setAllItems],
  )

  /**
   * Prefill and insert a new job from FO number
   * Fetches PHC data, creates job, and imports items
   */
  const prefillAndInsertFromFo = useCallback(
    async (foNumber: string, tempJobId: string) => {
      // Prevent duplicate imports from multiple tabs
      const importKey = `${foNumber}-${tempJobId}`

      if (foImportsInProgress.current.has(importKey)) {
        console.log('⚠️ Import already in progress for FO:', foNumber, 'job:', tempJobId)
        return
      }

      foImportsInProgress.current.add(importKey)

      try {
        const header = await fetchPhcHeaderByFo(foNumber)

        console.log('🔍 PHC Header Response:', {
          foNumber,
          header,
          nome_trabalho: header?.nome_trabalho,
          observacoes: header?.observacoes,
          orcamento_number: header?.orcamento_number,
          customer_id: header?.customer_id,
        })

        let phcFolhaObraId: string | null = null
        let insertData: any = {
          Numero_do_: foNumber,
          Trabalho: '',
          Nome: '',
          numero_orc: null,
          customer_id: null,
        }

        if (header) {
          phcFolhaObraId = header.folha_obra_id
          // Use nome_trabalho if available, otherwise fall back to observacoes
          const campaignName = header.nome_trabalho || header.observacoes
          if (campaignName) insertData.Trabalho = campaignName

          if (header.orcamento_number) {
            // numero_orc is now TEXT - store as string
            insertData.numero_orc = String(header.orcamento_number)
          }

          const { id_cliente, cliente } = await resolveClienteName(header.customer_id ?? null)
          insertData.Nome = cliente

          // Store customer_id from PHC directly
          if (header.customer_id) {
            insertData.customer_id = header.customer_id
          }
        }

        console.log('💾 Insert Data:', insertData)

        const { data: newJob, error } = await supabase
          .from('folhas_obras')
          .insert(insertData)
          .select('id, numero_fo:Numero_do_, numero_orc, nome_campanha:Trabalho, cliente:Nome')
          .single()

        console.log('📥 Returned from INSERT+SELECT:', { newJob, error })

        if (error) throw error

        if (newJob) {
          const mappedJob = {
            id: (newJob as any).id,
            numero_fo: (newJob as any).numero_fo || foNumber,
            numero_orc: (newJob as any).numero_orc ?? null,
            nome_campanha: (newJob as any).nome_campanha || '',
            cliente: (newJob as any).cliente || '',
            data_saida: null,
            prioridade: null,
            notas: null,
            id_cliente: header
              ? (await resolveClienteName(header.customer_id ?? null)).id_cliente
              : null,
            data_in: header?.folha_obra_date ?? null,
          } as Job

          console.log('🎯 Mapped Job for UI:', mappedJob)

          setJobs((prev) => prev.map((j) => (j.id === tempJobId ? mappedJob : j)))

          if (phcFolhaObraId) {
            await importPhcLinesForFo(phcFolhaObraId, (newJob as any).id, foNumber)
            setOpenId((newJob as any).id)
          }
        }
      } finally {
        // Always remove the import key from the set
        foImportsInProgress.current.delete(importKey)
      }
    },
    [
      fetchPhcHeaderByFo,
      resolveClienteName,
      importPhcLinesForFo,
      supabase,
      setJobs,
      setOpenId,
      foImportsInProgress,
    ],
  )

  return {
    fetchPhcHeaderByFo,
    fetchPhcHeaderByOrc,
    resolveClienteName,
    importPhcLinesForFo,
    prefillAndInsertFromFo,
  }
}
