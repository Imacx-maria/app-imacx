/**
 * Import Planos Logic
 * ------------------
 * Handles importing designer planos into production operations
 * Following the Print & Cut Workflow Spec:
 * - Creates source records with planned quantities
 * - Automatically creates linked cut operations for print jobs
 * - Sets up job grouping IDs for tracking splits
 */

import { format } from "date-fns";
import { logOperationCreation } from "@/utils/auditLogging";

interface DesignerPlano {
  id: string;
  item_id: string;
  plano_nome: string;
  plano_ordem: number;
  tipo_operacao: string;
  quantidade: number;
  material_id?: string | null;
  maquina?: string | null;
  cores?: string | null;
  notas?: string | null;
  criado_em_producao: boolean;
}

interface ImportPlanosParams {
  planos: DesignerPlano[];
  itemId: string;
  folhaObraId: string;
  numeroFo?: string;
  supabase: any;
}

/**
 * Import designer planos as source records with planned quantities
 * Creates the initial job structure following the workflow spec
 */
export async function importPlanosAsSourceRecords({
  planos,
  itemId,
  folhaObraId,
  numeroFo,
  supabase,
}: ImportPlanosParams): Promise<{
  success: boolean;
  importedCount: number;
  error?: string;
}> {
  let importedCount = 0;
  const errors: string[] = [];

  try {
    // Fetch machines mapping for legacy planos
    const { data: machinesData } = await supabase
      .from("maquinas_operacao")
      .select("id, nome_maquina");

    const machineNameToId = new Map<string, string>();
    if (machinesData) {
      machinesData.forEach((m: any) => {
        machineNameToId.set(m.nome_maquina.toUpperCase(), m.id);
      });
    }

    for (const plano of planos) {
      try {
        // Generate unique identifiers
        const now = new Date();
        const dateStr = format(now, "yyyyMMdd");
        const timeStr = format(now, "HHmmss");
        const foShort = numeroFo?.substring(0, 6) || "FO";

        const typePrefix =
          plano.tipo_operacao === "Impressao"
            ? "IMP"
            : plano.tipo_operacao === "Impressao_Flexiveis"
              ? "FLX"
              : "CRT";

        const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}-${plano.plano_ordem}`;

        // Handle legacy machine names
        let maquinaId = plano.maquina;
        if (plano.maquina && !isUUID(plano.maquina)) {
          maquinaId = machineNameToId.get(plano.maquina.toUpperCase()) || null;
        }

        // Generate job IDs for grouping
        const printJobId =
          plano.tipo_operacao === "Impressao" ||
          plano.tipo_operacao === "Impressao_Flexiveis"
            ? crypto.randomUUID()
            : null;

        const cutJobId =
          plano.tipo_operacao === "Corte" ? crypto.randomUUID() : null;

        // Create SOURCE RECORD with planned quantities
        const sourceOperationData = {
          // Basic fields
          item_id: itemId,
          folha_obra_id: folhaObraId,
          Tipo_Op: plano.tipo_operacao,
          data_operacao: new Date().toISOString().split("T")[0],
          no_interno,

          // Planning data
          plano_nome: plano.plano_nome,
          cores: plano.cores,
          material_id: plano.material_id,
          notas_imp: plano.notas,

          // SOURCE RECORD SPECIFIC - Planned quantities go here!
          is_source_record: true,
          qt_print_planned:
            plano.tipo_operacao === "Impressao" ||
            plano.tipo_operacao === "Impressao_Flexiveis"
              ? plano.quantidade
              : null,
          qt_corte_planned:
            plano.tipo_operacao === "Corte" ? plano.quantidade : null,

          // Job grouping IDs
          print_job_id: printJobId,
          cut_job_id: cutJobId,

          // Execution fields start empty for source records
          num_placas_print:
            plano.tipo_operacao === "Impressao" ||
            plano.tipo_operacao === "Impressao_Flexiveis"
              ? plano.quantidade
              : 0,
          num_placas_corte:
            plano.tipo_operacao === "Corte" ? plano.quantidade : 0,
          operador_id: null,
          maquina: null, // Machine will be selected during execution
          concluido: false,

          // Legacy fields (being phased out)
          QT_print: plano.quantidade, // Keep for backwards compatibility
        };

        // Insert source record
        const { data: savedSourceOp, error: sourceError } = await supabase
          .from("producao_operacoes")
          .insert([sourceOperationData])
          .select()
          .single();

        if (sourceError) {
          errors.push(
            `Erro ao criar operação ${plano.plano_nome}: ${sourceError.message}`,
          );
          continue;
        }

        // Log the source record creation
        await logOperationCreation(
          supabase,
          savedSourceOp.id,
          sourceOperationData,
        );

        // Mark plano as imported
        await supabase
          .from("designer_planos")
          .update({
            criado_em_producao: true,
            producao_operacao_id: savedSourceOp.id,
          })
          .eq("id", plano.id);

        // For PRINT operations, automatically create linked CUT operation
        if (
          plano.tipo_operacao === "Impressao" ||
          plano.tipo_operacao === "Impressao_Flexiveis"
        ) {
          const corteNoInterno = `${no_interno}-CORTE`;

          // Create CUT source record linked to this print job
          const cutSourceData = {
            // Basic fields
            Tipo_Op: "Corte",
            item_id: itemId,
            folha_obra_id: folhaObraId,
            data_operacao: new Date().toISOString().split("T")[0],
            no_interno: corteNoInterno,

            // Link to print job
            source_impressao_id: savedSourceOp.id,

            // Planning data from print job
            material_id: plano.material_id,
            plano_nome: plano.plano_nome,
            cores: plano.cores,

            // CUT SOURCE RECORD - planned qty same as print
            is_source_record: true,
            qt_corte_planned: plano.quantidade,
            cut_job_id: crypto.randomUUID(),

            // Execution fields empty
            num_placas_corte: plano.quantidade,
            operador_id: null,
            maquina: null,
            concluido: false,

            // Legacy
            QT_print: plano.quantidade,
          };

          const { data: cutOp, error: cutError } = await supabase
            .from("producao_operacoes")
            .insert([cutSourceData])
            .select()
            .single();

          if (cutError) {
            errors.push(
              `Erro ao criar operação de corte para ${plano.plano_nome}: ${cutError.message}`,
            );
          } else {
            await logOperationCreation(supabase, cutOp.id, cutSourceData);
          }
        }

        importedCount++;
      } catch (planoError: any) {
        errors.push(
          `Erro ao processar plano ${plano.plano_nome}: ${planoError.message}`,
        );
      }
    }

    if (errors.length > 0) {
      console.error("Erros durante importação:", errors);
    }

    return {
      success: importedCount > 0,
      importedCount,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  } catch (error: any) {
    console.error("Erro fatal ao importar planos:", error);
    return {
      success: false,
      importedCount: 0,
      error: error.message || "Erro desconhecido",
    };
  }
}

/**
 * Helper function to check if a string is a valid UUID
 */
function isUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Create first execution record from source
 * This is called when operator starts working on a job
 */
export async function createFirstExecutionFromSource(
  sourceOp: any,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();
    const timeStr = format(now, "HHmmss");

    const executionData = {
      // Copy all relevant fields from source
      item_id: sourceOp.item_id,
      folha_obra_id: sourceOp.folha_obra_id,
      Tipo_Op: sourceOp.Tipo_Op,
      data_operacao: new Date().toISOString().split("T")[0],
      no_interno: `${sourceOp.no_interno}-EXEC-${timeStr}`,

      // Copy planning data
      plano_nome: sourceOp.plano_nome,
      cores: sourceOp.cores,
      material_id: sourceOp.material_id,
      notas_imp: sourceOp.notas_imp,

      // Link to source and job
      parent_operation_id: sourceOp.id,
      print_job_id: sourceOp.print_job_id,
      cut_job_id: sourceOp.cut_job_id,
      source_impressao_id: sourceOp.source_impressao_id,

      // This is an execution record
      is_source_record: false,

      // Operator will fill these
      num_placas_print: 0,
      num_placas_corte: 0,
      operador_id: null,
      maquina: null,
      concluido: false,
    };

    const { data, error } = await supabase
      .from("producao_operacoes")
      .insert([executionData])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logOperationCreation(supabase, data.id, executionData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
