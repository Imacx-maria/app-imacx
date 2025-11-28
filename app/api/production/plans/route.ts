import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CreateProductionPlanInput } from "@/types/producao";

/**
 * POST /api/production/plans
 * Creates a new production plan
 * If tipo='impressao', automatically creates the corresponding cutting plan
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
    const body: CreateProductionPlanInput = await request.json();

    if (!body.item_id || !body.nome || !body.tipo || !body.processo || !body.quantidade_chapas) {
      return NextResponse.json(
        { error: "Missing required fields: item_id, nome, tipo, processo, quantidade_chapas" },
        { status: 400 }
      );
    }

    // Validate constraints
    if (body.tipo === "impressao" && body.processo === "so_corte") {
      return NextResponse.json(
        { error: "Impressao plans cannot have processo 'so_corte'" },
        { status: 400 }
      );
    }

    if (body.tipo === "corte" && body.processo === "impressao_corte" && !body.plano_impressao_id) {
      return NextResponse.json(
        { error: "Corte plans with processo 'impressao_corte' must have plano_impressao_id" },
        { status: 400 }
      );
    }

    if (body.tipo === "corte" && body.processo === "so_corte" && body.plano_impressao_id) {
      return NextResponse.json(
        { error: "Corte plans with processo 'so_corte' cannot have plano_impressao_id" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create the plan
    const { data: plan, error: planError } = await supabase
      .from("production_plans")
      .insert({
        item_id: body.item_id,
        nome: body.nome,
        tipo: body.tipo,
        processo: body.processo,
        origem: body.origem || "operador",
        quantidade_chapas: body.quantidade_chapas,
        maquina_prevista: body.maquina_prevista || null,
        material_tipo: body.material_tipo || null,
        material_espessura: body.material_espessura || null,
        material_acabamento: body.material_acabamento || null,
        cores: body.cores || null,
        plano_impressao_id: body.plano_impressao_id || null,
        notas: body.notas || null,
      })
      .select()
      .single();

    if (planError) {
      console.error("[Production Plans] Insert error:", planError);
      return NextResponse.json(
        { error: `Failed to create plan: ${planError.message}` },
        { status: 500 }
      );
    }

    // If it's an impressao plan, automatically create the cutting plan
    let cuttingPlan = null;
    if (body.tipo === "impressao") {
      const { data: cutPlan, error: cutError } = await supabase
        .from("production_plans")
        .insert({
          item_id: body.item_id,
          nome: body.nome,
          tipo: "corte",
          processo: "impressao_corte",
          origem: body.origem || "operador",
          quantidade_chapas: body.quantidade_chapas,
          plano_impressao_id: plan.id,
          notas: null,
        })
        .select()
        .single();

      if (cutError) {
        console.error("[Production Plans] Failed to create cutting plan:", cutError);
        // Don't fail the request, but log the error
      } else {
        cuttingPlan = cutPlan;
      }
    }

    return NextResponse.json(
      {
        plan,
        cuttingPlan,
        message: cuttingPlan
          ? "Plano de impressão e corte criados com sucesso"
          : "Plano criado com sucesso",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Production Plans] Error:", error);
    return NextResponse.json(
      { error: "Failed to create production plan" },
      { status: 500 }
    );
  }
}
