import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/financial-analysis/conversion-rates
 *
 * Returns company-wide conversion rates by escalão (value bracket)
 * Aggregates data across ALL departments (no department filter)
 *
 * Query Parameters:
 * - period: "mtd" | "ytd" (default: "ytd")
 *
 * Uses RPC function:
 * - get_company_conversion_rates(start_date, end_date)
 *
 * Performance: FASTER than department-filtered version (removes 4 JOINs)
 */
export async function GET(request: Request) {
  // Step 1: Validate authentication
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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "ytd"; // 'mtd' or 'ytd'

    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculate date ranges based on period
    let startDate: Date;
    let endDate: Date;

    if (period === "mtd") {
      // MTD: Month-to-Date
      startDate = new Date(currentYear, now.getMonth(), 1);
      endDate = now;
    } else {
      // YTD: Year-to-Date (default)
      startDate = new Date(currentYear, 0, 1);
      endDate = now;
    }

    const supabase = createAdminClient();

    console.log("📊 [API] Calling get_company_conversion_rates with params:", {
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      period,
    });

    // Call company-wide conversion rates RPC function
    const { data: conversaoData, error: conversaoError } = await supabase.rpc(
      "get_company_conversion_rates",
      {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      },
    );

    if (conversaoError) {
      console.error(
        "[API] ❌ Error fetching company conversion rates:",
        conversaoError,
      );
      console.error("[API] Error details:", {
        message: conversaoError.message,
        details: conversaoError.details,
        hint: conversaoError.hint,
        code: conversaoError.code,
      });
      throw conversaoError;
    }

    console.log("📊 [API] Raw data from Supabase:", {
      dataLength: conversaoData?.length || 0,
      firstRow: conversaoData?.[0],
    });

    // Format response
    const conversao = (conversaoData || []).map((row: any) => ({
      escalao: row.value_bracket,
      total_orcamentos: row.quote_count,
      total_faturas: row.invoice_count,
      taxa_conversao_pct: row.conversion_rate,
      total_valor_orcado: row.total_quoted_value,
      total_valor_faturado: row.total_invoiced_value,
    }));

    console.log("📊 [API Conversion Rates] Response:", {
      period,
      count: conversao.length,
      date_range: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
    });

    return NextResponse.json({
      success: true,
      conversao,
      period,
      date_range: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("[API] CONVERSION RATES ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error: true,
        message: error instanceof Error ? error.message : "Unknown error",
        conversao: [],
      },
      { status: 500 },
    );
  }
}
