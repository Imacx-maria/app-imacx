import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CreateExecutionInput } from "@/types/producao";

/**
 * POST /api/production/executions
 * Creates a new execution record
 * Validates material requirements based on plan type/processo
 */
export async function POST(request: Request) {
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CreateExecutionInput = await request.json();

    if (!body.plano_id || !body.operador_nome || !body.maquina || !body.quantidade_executada) {
      return NextResponse.json(
        { error: "Missing required fields: plano_id, operador_nome, maquina, quantidade_executada" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get the plan to validate material requirements
    const { data: plan, error: planError } = await supabase
      .from("production_plans")
      .select("*")
      .eq("id", body.plano_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Validate material requirements
    const requiresMaterial =
      plan.tipo === "impressao" ||
      (plan.tipo === "corte" && plan.processo === "so_corte");

    if (requiresMaterial && !body.material) {
      return NextResponse.json(
        { error: "Material is required for this operation type" },
        { status: 400 }
      );
    }

    if (!requiresMaterial && body.material) {
      return NextResponse.json(
        { error: "Material should not be provided for cutting operations with printed material" },
        { status: 400 }
      );
    }

    // For corte with impressao_corte, validate available quantity
    if (plan.tipo === "corte" && plan.processo === "impressao_corte" && plan.plano_impressao_id) {
      // Get total executed in the linked print plan
      const { data: printExecutions } = await supabase
        .from("production_executions")
        .select("quantidade_executada")
        .eq("plano_id", plan.plano_impressao_id);

      const totalPrinted = (printExecutions || []).reduce(
        (sum, e) => sum + (e.quantidade_executada || 0),
        0
      );

      // Get total already cut
      const { data: cutExecutions } = await supabase
        .from("production_executions")
        .select("quantidade_executada")
        .eq("plano_id", plan.id);

      const totalCut = (cutExecutions || []).reduce(
        (sum, e) => sum + (e.quantidade_executada || 0),
        0
      );

      const availableToCut = totalPrinted - totalCut;

      if (body.quantidade_executada > availableToCut) {
        return NextResponse.json(
          {
            error: `Quantidade excede o disponível para corte. Impresso: ${totalPrinted}, Já cortado: ${totalCut}, Disponível: ${availableToCut}`,
            warning: true,
            availableToCut,
          },
          { status: 400 }
        );
      }
    }

    // Create the execution
    const { data: execution, error: execError } = await supabase
      .from("production_executions")
      .insert({
        plano_id: body.plano_id,
        data_hora: body.data_hora || new Date().toISOString(),
        operador_id: body.operador_id || null,
        operador_nome: body.operador_nome,
        maquina: body.maquina,
        quantidade_executada: body.quantidade_executada,
        notas: body.notas || null,
      })
      .select()
      .single();

    if (execError) {
      console.error("[Production Executions] Insert error:", execError);
      return NextResponse.json(
        { error: `Failed to create execution: ${execError.message}` },
        { status: 500 }
      );
    }

    // If material is provided, create the material record
    let material = null;
    if (body.material) {
      const { data: mat, error: matError } = await supabase
        .from("execution_materials")
        .insert({
          execution_id: execution.id,
          palette_id: body.material.palette_id || null,
          material_tipo: body.material.material_tipo,
          material_espessura: body.material.material_espessura || null,
          material_acabamento: body.material.material_acabamento || null,
          material_referencia: body.material.material_referencia || null,
          quantidade_placas: body.material.quantidade_placas,
          is_placa_individual: body.material.is_placa_individual,
        })
        .select()
        .single();

      if (matError) {
        console.error("[Production Executions] Material insert error:", matError);
        // Don't fail the request, but log
      } else {
        material = mat;
      }
    }

    return NextResponse.json(
      {
        execution,
        material,
        message: "Execução registada com sucesso",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Production Executions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create execution" },
      { status: 500 }
    );
  }
}
