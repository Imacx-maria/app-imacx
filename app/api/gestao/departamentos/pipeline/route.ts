import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/gestao/departamentos/pipeline
 *
 * Returns pipeline data for department follow-up using proper user_siglas → profiles → departamentos join chain
 * Categories:
 * - Top 15: Biggest open quotes (≤30 days old)
 * - Needs Attention: Open quotes 30-60 days old
 * - Lost: Open quotes >60 days old
 *
 * Uses RPC function: get_department_pipeline_v2
 */
export async function GET(request: Request) {
  try {
    // Step 1: Authenticate
    const cookieStore = cookies();
    const authClient = await createServerClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 2: Get query parameters
    const { searchParams } = new URL(request.url);
    const departamento = searchParams.get("departamento") || "Brindes";
    const periodo = searchParams.get("periodo") || "anual"; // 'mensal' or 'anual'

    console.log(
      "🔍 [Pipeline] Requested departamento:",
      departamento,
      "| Periodo:",
      periodo,
    );

    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculate date range based on periodo
    let startDate: Date;
    let endDate: Date;

    if (periodo === "mensal") {
      // MTD: Month-to-Date
      startDate = new Date(currentYear, now.getMonth(), 1);
      endDate = now;
    } else {
      // YTD: Year-to-Date
      startDate = new Date(currentYear, 0, 1);
      endDate = now;
    }

    // Step 3: Query with admin client using separate RPC functions per category
    // This avoids the 1000 row limit by allowing each category to return up to 1000 rows
    const supabase = createAdminClient();

    const rpcParams = {
      departamento_nome: departamento,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };

    // Call all three functions in parallel
    const [top15Result, needsAttentionResult, perdidosResult] =
      await Promise.all([
        supabase.rpc("get_department_pipeline_top15", rpcParams),
        supabase.rpc("get_department_pipeline_needs_attention", rpcParams),
        supabase.rpc("get_department_pipeline_perdidos", rpcParams),
      ]);

    // Check for errors
    if (top15Result.error) {
      console.error("❌ [Pipeline] Top15 RPC Error:", top15Result.error);
      return NextResponse.json(
        {
          error: "Database error",
          message: top15Result.error.message,
          departamento,
          top15: [],
          needsAttention: [],
          perdidos: [],
        },
        { status: 500 },
      );
    }

    if (needsAttentionResult.error) {
      console.error(
        "❌ [Pipeline] NeedsAttention RPC Error:",
        needsAttentionResult.error,
      );
      return NextResponse.json(
        {
          error: "Database error",
          message: needsAttentionResult.error.message,
          departamento,
          top15: [],
          needsAttention: [],
          perdidos: [],
        },
        { status: 500 },
      );
    }

    if (perdidosResult.error) {
      console.error("❌ [Pipeline] Perdidos RPC Error:", perdidosResult.error);
      return NextResponse.json(
        {
          error: "Database error",
          message: perdidosResult.error.message,
          departamento,
          top15: [],
          needsAttention: [],
          perdidos: [],
        },
        { status: 500 },
      );
    }

    // Warn if any category hit the 1000 row limit
    if (needsAttentionResult.data?.length === 1000) {
      console.warn(
        `⚠️ [Pipeline] NeedsAttention returned exactly 1000 rows. Some quotes may be missing.`,
      );
    }
    if (perdidosResult.data?.length === 1000) {
      console.warn(
        `⚠️ [Pipeline] Perdidos returned exactly 1000 rows. Some quotes may be missing.`,
      );
    }

    // Step 4: Map results to response format
    const top15 = (top15Result.data || []).map((row: any) => ({
      orcamento_id_humano: row.quote_number,
      document_date: row.quote_date,
      cliente_nome: row.customer_name,
      total_value: row.quote_value,
      status: row.quote_status,
      dias_decorridos: row.quote_days_open,
      is_dismissed: row.is_dismissed || false,
      departamento,
    }));

    const needsAttention = (needsAttentionResult.data || []).map((row: any) => ({
      orcamento_id_humano: row.quote_number,
      document_date: row.quote_date,
      cliente_nome: row.customer_name,
      total_value: row.quote_value,
      status: row.quote_status,
      dias_decorridos: row.quote_days_open,
      is_dismissed: row.is_dismissed || false,
      departamento,
    }));

    const perdidos = (perdidosResult.data || []).map((row: any) => ({
      orcamento_id_humano: row.quote_number,
      document_date: row.quote_date,
      cliente_nome: row.customer_name,
      total_value: row.quote_value,
      status: row.quote_status,
      dias_decorridos: row.quote_days_open,
      is_dismissed: row.is_dismissed || false,
      departamento,
    }));

    // Format response
    const response = {
      departamento,
      periodo: periodo,
      date_range: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
      top15,
      needsAttention,
      perdidos,
      metadata: {
        generatedAt: new Date().toISOString(),
        counts: {
          top15: top15.length,
          needsAttention: needsAttention.length,
          perdidos: perdidos.length,
        },
      },
    };

    console.log(`📊 [Pipeline] Response for ${departamento}:`, {
      top15: response.metadata.counts.top15,
      needsAttention: response.metadata.counts.needsAttention,
      perdidos: response.metadata.counts.perdidos,
    });

    // Debug: Log first item from each category to verify department filtering
    if (response.metadata.counts.top15 > 0) {
      console.log(`  ✓ Top15[0]:`, {
        quote: top15[0]?.orcamento_id_humano,
        customer: top15[0]?.cliente_nome,
        value: top15[0]?.total_value,
        days_open: top15[0]?.dias_decorridos,
      });
    }
    if (response.metadata.counts.needsAttention > 0) {
      console.log(`  ✓ NeedsAttention[0]:`, {
        quote: needsAttention[0]?.orcamento_id_humano,
        customer: needsAttention[0]?.cliente_nome,
        days_open: needsAttention[0]?.dias_decorridos,
      });
    }
    if (response.metadata.counts.perdidos > 0) {
      console.log(`  ✓ Perdidos[0]:`, {
        quote: perdidos[0]?.orcamento_id_humano,
        customer: perdidos[0]?.cliente_nome,
        days_open: perdidos[0]?.dias_decorridos,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [Pipeline] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        departamento: "unknown",
        top15: [],
        needsAttention: [],
        perdidos: [],
      },
      { status: 500 },
    );
  }
}
