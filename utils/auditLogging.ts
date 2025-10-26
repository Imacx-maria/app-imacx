// Enhanced audit logging functions for comprehensive tracking

interface AuditLogEntry {
  operacao_id: string
  action_type: 'INSERT' | 'UPDATE' | 'DELETE'
  field_name?: string
  operador_antigo?: string | null
  operador_novo?: string | null
  quantidade_antiga?: number | null
  quantidade_nova?: number | null
  old_value?: string | null
  new_value?: string | null
  operation_details?: any
  notes?: string
}

// Helper function to get current authenticated user
const getCurrentUser = async (supabase: any) => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('No authenticated user found for audit logging')
  }
  return user
}

// Helper function to resolve operator names for display
const resolveOperatorName = async (
  supabase: any,
  operatorId: string | null,
): Promise<string> => {
  if (!operatorId) return '-'

  try {
    const { data: operator, error } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', operatorId)
      .single()

    if (!error && operator) {
      return `${operator.first_name} ${operator.last_name}`
    }
  } catch (error) {
    console.warn('⚠️ Failed to resolve operator name for ID:', operatorId)
  }

  return `Operador ${operatorId.substring(0, 8)}...`
}

// 1. Log operation creation (INSERT)
const logOperationCreation = async (
  supabase: any,
  operationId: string,
  operationData: any,
) => {
  try {
    console.log('📝 AUDIT: Logging operation creation:', operationId)

    const user = await getCurrentUser(supabase)

    const auditData: AuditLogEntry = {
      operacao_id: operationId,
      action_type: 'INSERT',
      operador_novo: operationData.operador_id || null,
      quantidade_nova:
        operationData.num_placas_print || operationData.num_placas_corte || 0,
      operation_details: operationData,
      notes: 'Operação criada',
    }

    const { error } = await supabase.from('producao_operacoes_audit').insert({
      ...auditData,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    })

    if (error) {
      console.error('❌ AUDIT: Failed to log operation creation:', error)
    } else {
      console.log('✅ AUDIT: Operation creation logged successfully')
    }
  } catch (error) {
    console.error(
      '❌ AUDIT: Unexpected error logging operation creation:',
      error,
    )
  }
}

// 2. Log field updates (UPDATE)
const logFieldUpdate = async (
  supabase: any,
  operationId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  operationContext?: any,
) => {
  try {
    console.log(
      `📝 AUDIT: Logging field update - ${fieldName}: "${oldValue}" → "${newValue}"`,
    )

    const user = await getCurrentUser(supabase)

    // Convert values to strings for storage, but keep originals for specific fields
    const oldValueStr =
      oldValue !== null && oldValue !== undefined ? String(oldValue) : null
    const newValueStr =
      newValue !== null && newValue !== undefined ? String(newValue) : null

    // Skip if no actual change
    if (oldValueStr === newValueStr) {
      console.log('📝 AUDIT: No change detected, skipping log')
      return
    }

    const auditData: AuditLogEntry = {
      operacao_id: operationId,
      action_type: 'UPDATE',
      field_name: fieldName,
      old_value: oldValueStr,
      new_value: newValueStr,
    }

    // Handle specific field types with dedicated columns
    if (fieldName === 'operador_id') {
      auditData.operador_antigo = oldValue
      auditData.operador_novo = newValue
    } else if (
      fieldName === 'num_placas_print' ||
      fieldName === 'num_placas_corte'
    ) {
      auditData.quantidade_antiga = oldValue ? Number(oldValue) : null
      auditData.quantidade_nova = newValue ? Number(newValue) : null
    }

    const { error } = await supabase.from('producao_operacoes_audit').insert({
      ...auditData,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    })

    if (error) {
      console.error('❌ AUDIT: Failed to log field update:', error)
    } else {
      console.log('✅ AUDIT: Field update logged successfully')
    }
  } catch (error) {
    console.error('❌ AUDIT: Unexpected error logging field update:', error)
  }
}

// 3. Log operation deletion (DELETE)
const logOperationDeletion = async (
  supabase: any,
  operationId: string,
  operationData: any,
) => {
  try {
    console.log('📝 AUDIT: Logging operation deletion:', operationId)

    const user = await getCurrentUser(supabase)

    const auditData: AuditLogEntry = {
      operacao_id: operationId,
      action_type: 'DELETE',
      operador_antigo: operationData.operador_id || null,
      quantidade_antiga:
        operationData.num_placas_print || operationData.num_placas_corte || 0,
      operation_details: operationData,
      notes: 'Operação eliminada',
    }

    const { error } = await supabase.from('producao_operacoes_audit').insert({
      ...auditData,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    })

    if (error) {
      console.error('❌ AUDIT: Failed to log operation deletion:', error)
    } else {
      console.log('✅ AUDIT: Operation deletion logged successfully')
    }
  } catch (error) {
    console.error(
      '❌ AUDIT: Unexpected error logging operation deletion:',
      error,
    )
  }
}

// 4. Fetch enhanced audit logs with all details
const fetchEnhancedAuditLogs = async (supabase: any) => {
  try {
    console.log('🔍 Fetching enhanced audit logs...')

    const { data: auditData, error } = await supabase
      .from('producao_operacoes_audit')
      .select(
        `
        id,
        operacao_id,
        action_type,
        field_name,
        operador_antigo,
        operador_novo,
        quantidade_antiga,
        quantidade_nova,
        old_value,
        new_value,
        operation_details,
        notes,
        changed_at,
        changed_by,
        producao_operacoes!operacao_id (
          no_interno,
          folha_obra_id,
          item_id,
          folhas_obras!folha_obra_id (
            Numero_do_
          ),
          items_base!item_id (
            descricao
          )
        ),
        profiles!changed_by (
          first_name,
          last_name
        )
      `,
      )
      .order('changed_at', { ascending: false })
      .limit(200)

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`)
    }

    // Enhance data with resolved operator names
    const enhancedLogs = await Promise.all(
      (auditData || []).map(async (log: any) => {
        const enhanced = { ...log }

        // Resolve operator names for operador_antigo and operador_novo
        if (log.operador_antigo) {
          enhanced.operador_antigo_nome = await resolveOperatorName(
            supabase,
            log.operador_antigo,
          )
        }
        if (log.operador_novo) {
          enhanced.operador_novo_nome = await resolveOperatorName(
            supabase,
            log.operador_novo,
          )
        }

        return enhanced
      }),
    )

    console.log('✅ Enhanced audit logs fetched:', enhancedLogs.length)
    return enhancedLogs
  } catch (error) {
    console.error('❌ Error fetching enhanced audit logs:', error)
    throw error
  }
}

export {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
  fetchEnhancedAuditLogs,
  resolveOperatorName,
}

