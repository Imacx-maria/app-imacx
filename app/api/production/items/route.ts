import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CreateProductionItemInput } from "@/types/producao";

/**
 * GET /api/production/items
 * Lists production items with optional filters
 */
export async function GET(request: Request) {
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fo_id = searchParams.get("fo_id");
  const search = searchParams.get("search");

  const supabase = createAdminClient();

  try {
    let query = supabase.from("production_items").select("*");

    if (fo_id) {
      query = query.eq("fo_id", parseInt(fo_id));
    }

    if (search) {
      query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("[Production Items] Query error:", error);
      return NextResponse.json(
        { error: `Failed to fetch items: ${error.message}` },
        { status: 500 }
      );
    }

    // Get progress for each item
    const itemsWithProgress = await Promise.all(
      (data || []).map(async (item) => {
        const { data: summaryData } = await supabase.rpc(
          "get_plan_execution_summary",
          { p_item_id: item.id }
        );

        return {
          ...item,
          progress: {
            impressao: 0,
            corte: 0,
          },
        };
      })
    );

    return NextResponse.json({ items: itemsWithProgress });
  } catch (error) {
    console.error("[Production Items] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch production items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production/items
 * Creates a new production item
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
    const body: CreateProductionItemInput = await request.json();

    if (!body.fo_id || !body.fo_numero || !body.codigo || !body.descricao || !body.quantidade_total) {
      return NextResponse.json(
        { error: "Missing required fields: fo_id, fo_numero, codigo, descricao, quantidade_total" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("production_items")
      .insert({
        fo_id: body.fo_id,
        fo_numero: body.fo_numero,
        codigo: body.codigo,
        descricao: body.descricao,
        quantidade_total: body.quantidade_total,
        notas: body.notas || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[Production Items] Insert error:", error);
      return NextResponse.json(
        { error: `Failed to create item: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error("[Production Items] Error:", error);
    return NextResponse.json(
      { error: "Failed to create production item" },
      { status: 500 }
    );
  }
}
