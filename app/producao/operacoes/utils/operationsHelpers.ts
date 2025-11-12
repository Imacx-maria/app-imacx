/**
 * Operations Helper Utilities
 * Support functions for production operations workflow
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface ProductionOperation {
  id: string;
  data_operacao: string;
  operador_id?: string | null;
  folha_obra_id: string;
  item_id: string;
  no_interno: string;
  Tipo_Op?: string;
  maquina?: string | null;
  material_id?: string | null;
  stock_consumido_id?: string | null;
  num_placas_print?: number | null;
  num_placas_corte?: number | null;
  QT_print?: number | null;
  observacoes?: string | null;
  notas?: string | null;
  notas_imp?: string | null;
  status?: string;
  concluido?: boolean;
  data_conclusao?: string | null;
  created_at?: string;
  updated_at?: string;
  N_Pal?: string | null;
  tem_corte?: boolean | null;
  source_impressao_id?: string | null;
  plano_nome?: string | null;
  cores?: string | null;
  qt_print_planned?: number | null;
  qt_corte_planned?: number | null;
  print_job_id?: string | null;
  cut_job_id?: string | null;
  is_source_record?: boolean;
  parent_operation_id?: string | null;
}

/**
 * Calculate total executed quantity for a print job
 */
export async function calculatePrintJobProgress(
  supabase: SupabaseClient,
  printJobId: string
): Promise<{
  planned: number;
  executed: number;
  remaining: number;
  progress: number;
}> {
  try {
    // Get planned quantity from source record
    const { data: sourceData } = await supabase
      .from("producao_operacoes")
      .select("qt_print_planned")
      .eq("print_job_id", printJobId)
      .eq("is_source_record", true)
      .single();

    const planned = sourceData?.qt_print_planned || 0;

    // Get total executed from all split records
    const { data: execData } = await supabase
      .from("producao_operacoes")
      .select("num_placas_print")
      .eq("print_job_id", printJobId)
      .eq("is_source_record", false);

    const executed = execData?.reduce(
      (sum, row) => sum + (row.num_placas_print || 0),
      0
    ) || 0;

    const remaining = Math.max(0, planned - executed);
    const progress = planned > 0 ? Math.round((executed / planned) * 100) : 0;

    return { planned, executed, remaining, progress };
  } catch (error) {
    console.error("Error calculating print job progress:", error);
    return { planned: 0, executed: 0, remaining: 0, progress: 0 };
  }
}

/**
 * Calculate total executed quantity for a cut job
 */
export async function calculateCutJobProgress(
  supabase: SupabaseClient,
  cutJobId: string
): Promise<{
  planned: number;
  executed: number;
  remaining: number;
  progress: number;
}> {
  try {
    // Get planned quantity from source record
    const { data: sourceData } = await supabase
      .from("producao_operacoes")
      .select("qt_corte_planned")
      .eq("cut_job_id", cutJobId)
      .eq("is_source_record", true)
      .single();

    const planned = sourceData?.qt_corte_planned || 0;

    // Get total executed from all split records
    const { data: execData } = await supabase
      .from("producao_operacoes")
      .select("num_placas_corte")
      .eq("cut_job_id", cutJobId)
      .eq("is_source_record", false);

    const executed = execData?.reduce(
      (sum, row) => sum + (row.num_placas_corte || 0),
      0
    ) || 0;

    const remaining = Math.max(0, planned - executed);
    const progress = planned > 0 ? Math.round((executed / planned) * 100) : 0;

    return { planned, executed, remaining, progress };
  } catch (error) {
    console.error("Error calculating cut job progress:", error);
    return { planned: 0, executed: 0, remaining: 0, progress: 0 };
  }
}

/**
 * Calculate cut-from-print progress
 * Checks both total printed plates available and planned quantity
 */
export async function calculateCutFromPrintProgress(
  supabase: SupabaseClient,
  sourceImpressaoId: string
): Promise<{
  qtPrintPlanned: number;
  totalPrinted: number;
  totalCut: number;
  remaining: number;
  progress: number;
  canCut: boolean;
}> {
  try {
    // Get the print job details
    const { data: printOp } = await supabase
      .from("producao_operacoes")
      .select("print_job_id, qt_print_planned")
      .eq("id", sourceImpressaoId)
      .single();

    const qtPrintPlanned = printOp?.qt_print_planned || 0;
    const printJobId = printOp?.print_job_id;

    // Get total printed from all print splits
    let totalPrinted = 0;
    if (printJobId) {
      const { data: printData } = await supabase
        .from("producao_operacoes")
        .select("num_placas_print")
        .eq("print_job_id", printJobId)
        .eq("is_source_record", false);

      totalPrinted = printData?.reduce(
        (sum, row) => sum + (row.num_placas_print || 0),
        0
      ) || 0;
    }

    // Get total cut from all cut operations linked to this print job
    const { data: cutData } = await supabase
      .from("producao_operacoes")
      .select("num_placas_corte")
      .eq("source_impressao_id", sourceImpressaoId);

    const totalCut = cutData?.reduce(
      (sum, row) => sum + (row.num_placas_corte || 0),
      0
    ) || 0;

    // Remaining is the LESSER of (printed - cut) or (planned - cut)
    const remaining = Math.max(
      0,
      Math.min(totalPrinted - totalCut, qtPrintPlanned - totalCut)
    );

    const progress =
      qtPrintPlanned > 0 ? Math.round((totalCut / qtPrintPlanned) * 100) : 0;

    const canCut = totalPrinted > totalCut;

    return {
      qtPrintPlanned,
      totalPrinted,
      totalCut,
      remaining,
      progress,
      canCut,
    };
  } catch (error) {
    console.error("Error calculating cut-from-print progress:", error);
    return {
      qtPrintPlanned: 0,
      totalPrinted: 0,
      totalCut: 0,
      remaining: 0,
      progress: 0,
      canCut: false,
    };
  }
}

/**
 * Duplicate a production operation row for split operations
 * Smart quantity calculation based on remaining work
 */
export async function duplicateOperationRow(
  supabase: SupabaseClient,
  sourceOperation: ProductionOperation
): Promise<{ success: boolean; newOperationId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();

    // Calculate remaining quantity based on operation type
    let remainingQty = 0;

    if (
      sourceOperation.Tipo_Op === "Impressao" ||
      sourceOperation.Tipo_Op === "Impressao_Flexiveis"
    ) {
      if (sourceOperation.print_job_id) {
        const progress = await calculatePrintJobProgress(
          supabase,
          sourceOperation.print_job_id
        );
        remainingQty = progress.remaining;
      }
    } else if (sourceOperation.Tipo_Op === "Corte") {
      if (sourceOperation.source_impressao_id) {
        // Cut-from-print
        const progress = await calculateCutFromPrintProgress(
          supabase,
          sourceOperation.source_impressao_id
        );
        remainingQty = progress.remaining;
      } else if (sourceOperation.cut_job_id) {
        // Cut-only
        const progress = await calculateCutJobProgress(
          supabase,
          sourceOperation.cut_job_id
        );
        remainingQty = progress.remaining;
      }
    }

    // Create new operation record with smart defaults
    const newOperation: any = {
      folha_obra_id: sourceOperation.folha_obra_id,
      item_id: sourceOperation.item_id,
      Tipo_Op: sourceOperation.Tipo_Op,
      no_interno: sourceOperation.no_interno,
      data_operacao: sourceOperation.data_operacao,

      // Copy linking fields
      print_job_id: sourceOperation.print_job_id || null,
      cut_job_id: sourceOperation.cut_job_id || null,
      source_impressao_id: sourceOperation.source_impressao_id || null,
      parent_operation_id: sourceOperation.id,
      is_source_record: false,

      // Copy metadata
      plano_nome: sourceOperation.plano_nome || null,
      cores: sourceOperation.cores || null,
      material_id: sourceOperation.material_id || null,
      N_Pal: sourceOperation.N_Pal || null,
      tem_corte: sourceOperation.tem_corte || null,

      // Set quantities - use remaining or 0
      num_placas_print:
        sourceOperation.Tipo_Op === "Impressao" ||
        sourceOperation.Tipo_Op === "Impressao_Flexiveis"
          ? remainingQty > 0
            ? remainingQty
            : 0
          : null,
      num_placas_corte:
        sourceOperation.Tipo_Op === "Corte"
          ? remainingQty > 0
            ? remainingQty
            : 0
          : null,
      QT_print: sourceOperation.QT_print || null,

      // Reset completion status
      concluido: false,
      status: "pendente",
      data_conclusao: null,

      // Timestamps
      created_at: now,
      updated_at: now,

      // Empty fields for user to fill
      operador_id: null,
      maquina: null,
      observacoes: null,
      notas: sourceOperation.Tipo_Op === "Corte" ? sourceOperation.notas : null,
      notas_imp:
        sourceOperation.Tipo_Op === "Impressao" ||
        sourceOperation.Tipo_Op === "Impressao_Flexiveis"
          ? sourceOperation.notas_imp
          : null,
    };

    const { data, error } = await supabase
      .from("producao_operacoes")
      .insert(newOperation)
      .select()
      .single();

    if (error) {
      console.error("Error duplicating operation:", error);
      return { success: false, error: error.message };
    }

    return { success: true, newOperationId: data.id };
  } catch (error: any) {
    console.error("Error in duplicateOperationRow:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-save a field change with debouncing
 */
export async function autoSaveField(
  supabase: SupabaseClient,
  operationId: string,
  field: string,
  value: any,
  logAudit?: (opId: string, field: string, oldVal: any, newVal: any) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalize the value
    let normalizedValue = value;

    // Handle numeric fields
    if (field === "num_placas_print" || field === "num_placas_corte") {
      const n = parseFloat(String(value));
      normalizedValue = Number.isFinite(n) ? n : 0;
    }

    // Handle UUID fields - convert empty string to null
    if (
      ["operador_id", "material_id", "maquina", "stock_consumido_id"].includes(
        field
      )
    ) {
      if (value === "") {
        normalizedValue = null;
      }
    }

    // Update database
    const { error } = await supabase
      .from("producao_operacoes")
      .update({ [field]: normalizedValue, updated_at: new Date().toISOString() })
      .eq("id", operationId);

    if (error) {
      console.error(`Error saving ${field}:`, error);
      return { success: false, error: error.message };
    }

    // Log audit if function provided
    if (logAudit) {
      await logAudit(operationId, field, null, normalizedValue);
    }

    return { success: true };
  } catch (error: any) {
    console.error(`Error in autoSaveField for ${field}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate quantity constraints before save
 */
export async function validateOperationQuantity(
  supabase: SupabaseClient,
  operation: ProductionOperation,
  newQuantity: number
): Promise<{ valid: boolean; error?: string; warning?: string }> {
  try {
    // For print operations
    if (
      (operation.Tipo_Op === "Impressao" ||
        operation.Tipo_Op === "Impressao_Flexiveis") &&
      operation.print_job_id
    ) {
      const progress = await calculatePrintJobProgress(
        supabase,
        operation.print_job_id
      );

      // Get current execution total excluding this operation
      const { data: otherOps } = await supabase
        .from("producao_operacoes")
        .select("num_placas_print")
        .eq("print_job_id", operation.print_job_id)
        .eq("is_source_record", false)
        .neq("id", operation.id);

      const otherTotal =
        otherOps?.reduce((sum, op) => sum + (op.num_placas_print || 0), 0) || 0;
      const newTotal = otherTotal + newQuantity;

      if (newTotal > progress.planned) {
        return {
          valid: false,
          error: `Total impresso (${newTotal}) excederia quantidade planeada (${progress.planned})`,
        };
      }

      if (newTotal === progress.planned) {
        return {
          valid: true,
          warning: "Esta operação completará o trabalho de impressão.",
        };
      }
    }

    // For cut-from-print operations
    if (operation.Tipo_Op === "Corte" && operation.source_impressao_id) {
      const progress = await calculateCutFromPrintProgress(
        supabase,
        operation.source_impressao_id
      );

      // Get current cut total excluding this operation
      const { data: otherOps } = await supabase
        .from("producao_operacoes")
        .select("num_placas_corte")
        .eq("source_impressao_id", operation.source_impressao_id)
        .neq("id", operation.id);

      const otherTotal =
        otherOps?.reduce((sum, op) => sum + (op.num_placas_corte || 0), 0) || 0;
      const newTotal = otherTotal + newQuantity;

      // Check against total printed (primary constraint)
      if (newTotal > progress.totalPrinted) {
        return {
          valid: false,
          error: `Total cortado (${newTotal}) excederia total impresso (${progress.totalPrinted})`,
        };
      }

      // Also check against planned
      if (newTotal > progress.qtPrintPlanned) {
        return {
          valid: false,
          error: `Total cortado (${newTotal}) excederia quantidade planeada (${progress.qtPrintPlanned})`,
        };
      }

      if (newTotal === progress.qtPrintPlanned) {
        return {
          valid: true,
          warning: "Esta operação completará o trabalho de corte.",
        };
      }
    }

    // For cut-only operations
    if (
      operation.Tipo_Op === "Corte" &&
      !operation.source_impressao_id &&
      operation.cut_job_id
    ) {
      const progress = await calculateCutJobProgress(
        supabase,
        operation.cut_job_id
      );

      // Get current cut total excluding this operation
      const { data: otherOps } = await supabase
        .from("producao_operacoes")
        .select("num_placas_corte")
        .eq("cut_job_id", operation.cut_job_id)
        .eq("is_source_record", false)
        .neq("id", operation.id);

      const otherTotal =
        otherOps?.reduce((sum, op) => sum + (op.num_placas_corte || 0), 0) || 0;
      const newTotal = otherTotal + newQuantity;

      if (newTotal > progress.planned) {
        return {
          valid: false,
          error: `Total cortado (${newTotal}) excederia quantidade planeada (${progress.planned})`,
        };
      }

      if (newTotal === progress.planned) {
        return {
          valid: true,
          warning: "Esta operação completará o trabalho de corte.",
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error("Error validating operation quantity:", error);
    return { valid: true }; // Allow if validation fails to not block user
  }
}
