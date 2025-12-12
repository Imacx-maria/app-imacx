import { createServerClient } from "@/utils/supabase";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type {
  QueryRequest,
  QueryResponse,
  SearchType,
} from "@/lib/status-hunter/types";
import { executeSearch, getFullStatus } from "@/lib/status-hunter/queries";

const VALID_TYPES: SearchType[] = [
  "FO",
  "ORC",
  "GUIA",
  "CLIENTE",
  "CAMPANHA",
  "ITEM",
];

/**
 * POST /api/status-hunter/query
 * Executes a status search query based on type and value
 */
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: QueryRequest = await request.json();

    // Validate request
    if (!body.type || !body.value) {
      return NextResponse.json(
        { error: "Campos obrigatorios: type, value" },
        { status: 400 },
      );
    }

    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Tipo invalido. Valores aceites: ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (body.value.trim().length < 1) {
      return NextResponse.json(
        { error: "Valor de pesquisa muito curto" },
        { status: 400 },
      );
    }

    // Execute search (cast needed due to Supabase client type mismatch)
    const matches = await executeSearch(
      supabase as unknown as Parameters<typeof executeSearch>[0],
      body.type,
      body.value.trim(),
    );

    const response: QueryResponse = { matches };

    // If exactly one match, get full status
    if (matches.length === 1) {
      const fullStatus = await getFullStatus(
        supabase as unknown as Parameters<typeof getFullStatus>[0],
        matches[0].id,
      );
      if (fullStatus) {
        response.fullStatus = fullStatus;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Status Hunter] Query error:", error);

    // Return user-friendly error message
    const message =
      error instanceof Error ? error.message : "Erro ao executar pesquisa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/status-hunter/query?id=<fo_id>
 * Gets full status for a specific FO by ID
 */
export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const foId = searchParams.get("id");

    if (!foId) {
      return NextResponse.json(
        { error: "Parametro obrigatorio: id" },
        { status: 400 },
      );
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(foId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const fullStatus = await getFullStatus(
      supabase as unknown as Parameters<typeof getFullStatus>[0],
      foId,
    );

    if (!fullStatus) {
      return NextResponse.json(
        { error: "Folha de Obra nao encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({ fullStatus });
  } catch (error) {
    console.error("[Status Hunter] Get status error:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao obter estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
