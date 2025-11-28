import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UpdateProductionPlanInput } from "@/types/producao";

/**
 * PUT /api/production/plans/[id]
 * Updates a production plan
 * If it's an impressao plan and quantidade_chapas changes, also updates the linked cutting plan
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
  }

  try {
    const body: UpdateProductionPlanInput = await request.json();
    const supabase = createAdminClient();

    // Get the current plan to check its type
    const { data: existingPlan, error: fetchError } = await supabase
      .from("production_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.quantidade_chapas !== undefined) updateData.quantidade_chapas = body.quantidade_chapas;
    if (body.maquina_prevista !== undefined) updateData.maquina_prevista = body.maquina_prevista;
    if (body.material_tipo !== undefined) updateData.material_tipo = body.material_tipo;
    if (body.material_espessura !== undefined) updateData.material_espessura = body.material_espessura;
    if (body.notas !== undefined) updateData.notas = body.notas;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Update the plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from("production_plans")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[Production Plans] Update error:", updateError);
      return NextResponse.json(
        { error: `Failed to update plan: ${updateError.message}` },
        { status: 500 }
      );
    }

    // If it's an impressao plan and quantidade_chapas changed, update the linked cutting plan
    if (
      existingPlan.tipo === "impressao" &&
      body.quantidade_chapas !== undefined &&
      body.quantidade_chapas !== existingPlan.quantidade_chapas
    ) {
      const { error: cutUpdateError } = await supabase
        .from("production_plans")
        .update({ quantidade_chapas: body.quantidade_chapas })
        .eq("plano_impressao_id", id);

      if (cutUpdateError) {
        console.error("[Production Plans] Failed to update linked cutting plan:", cutUpdateError);
      }
    }

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error("[Production Plans] Error:", error);
    return NextResponse.json(
      { error: "Failed to update production plan" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/production/plans/[id]
 * Deletes a production plan
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from("production_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Production Plans] Delete error:", error);
      return NextResponse.json(
        { error: `Failed to delete plan: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Production Plans] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete production plan" },
      { status: 500 }
    );
  }
}
