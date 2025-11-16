import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/gestao/departamentos/pipeline
 *
 * Returns pipeline data for department follow-up using proper user_siglas → profiles → departamentos join chain
 * Categories:
 * - Top 15: Biggest open quotes (≤30 days old)
 * - Needs Attention: Open quotes 30-60 days old
 * - Lost: Open quotes >60 days old
 *
 * Uses RPC function: get_department_pipeline
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

    // Step 3: Query with admin client using RPC
    const supabase = createAdminClient();

    const { data: pipelineData, error: pipelineError } = await supabase.rpc(
      "get_department_pipeline",
      {
        departamento_nome: departamento,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      },
    );

    if (pipelineError) {
      console.error("❌ [Pipeline] RPC Error:", pipelineError);
      return NextResponse.json(
        {
          error: "Database error",
          message: pipelineError.message,
          departamento,
          top15: [],
          needsAttention: [],
          perdidos: [],
        },
        { status: 500 },
      );
    }

    // Step 4: Split results by category
    const top15 = (pipelineData || [])
      .filter((row: any) => row.quote_category === "top_15") // FIXED: was row.category
      .map((row: any) => ({
        orcamento_id_humano: row.quote_number,
        document_date: row.quote_date,
        cliente_nome: row.customer_name,
        total_value: row.quote_value,
        status: row.quote_status, // FIXED: was row.status
        dias_decorridos: row.quote_days_open, // FIXED: was row.days_open
        departamento,
      }));

    const needsAttention = (pipelineData || [])
      .filter((row: any) => row.quote_category === "needs_attention") // FIXED: was row.category
      .map((row: any) => ({
        orcamento_id_humano: row.quote_number,
        document_date: row.quote_date,
        cliente_nome: row.customer_name,
        total_value: row.quote_value,
        status: row.quote_status, // FIXED: was row.status
        dias_decorridos: row.quote_days_open, // FIXED: was row.days_open
        departamento,
      }));

    const perdidos = (pipelineData || [])
      .filter((row: any) => row.quote_category === "lost") // FIXED: was row.category
      .map((row: any) => ({
        orcamento_id_humano: row.quote_number,
        document_date: row.quote_date,
        cliente_nome: row.customer_name,
        total_value: row.quote_value,
        status: row.quote_status, // FIXED: was row.status
        dias_decorridos: row.quote_days_open, // FIXED: was row.days_open
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
