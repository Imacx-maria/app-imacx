import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/gestao/departamentos/kpi
 *
 * Returns KPI metrics for departments (Brindes, Digital, IMACX)
 * Supports MTD and YTD periods
 *
 * Query params:
 * - departamento: "Brindes" | "Digital" | "IMACX" (required)
 * - period: "mtd" | "ytd" (default: "ytd")
 *
 * Uses RPC functions:
 * - calculate_department_kpis (for invoices/revenue)
 * - calculate_department_quotes (for quotes)
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
    console.error("❌ [Department KPI] Authentication failed:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("✅ [Department KPI] User authenticated:", user.email);

  try {
    // Step 2: Extract query parameters
    const { searchParams } = new URL(request.url);
    const departamento = searchParams.get("departamento");
    const period = searchParams.get("period") || "ytd";

    if (!departamento) {
      return NextResponse.json(
        { error: "Missing required parameter: departamento" },
        { status: 400 },
      );
    }

    if (!["Brindes", "Digital", "IMACX"].includes(departamento)) {
      return NextResponse.json(
        { error: "Invalid departamento. Must be: Brindes, Digital, or IMACX" },
        { status: 400 },
      );
    }

    if (!["mtd", "ytd"].includes(period)) {
      return NextResponse.json(
        { error: "Invalid period. Must be: mtd or ytd" },
        { status: 400 },
      );
    }

    console.log("📊 [Department KPI] Request:", { departamento, period });

    // Step 3: Calculate date ranges
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const currentDayOfMonth = now.getDate();

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (period === "mtd") {
      // Month-to-Date
      currentStart = new Date(currentYear, currentMonth, 1);
      currentEnd = now;
      previousStart = new Date(currentYear - 1, currentMonth, 1);
      previousEnd = new Date(currentYear - 1, currentMonth, currentDayOfMonth);
    } else {
      // Year-to-Date
      currentStart = new Date(currentYear, 0, 1);
      currentEnd = now;
      previousStart = new Date(currentYear - 1, 0, 1);
      previousEnd = new Date(currentYear - 1, currentMonth, currentDayOfMonth);
    }

    console.log("📊 [Department KPI] Date ranges:", {
      current: `${currentStart.toISOString().split("T")[0]} → ${currentEnd.toISOString().split("T")[0]}`,
      previous: `${previousStart.toISOString().split("T")[0]} → ${previousEnd.toISOString().split("T")[0]}`,
    });

    const supabase = createAdminClient();

    // Step 4: Fetch current period invoice KPIs
    const { data: currentInvoiceData, error: currentInvoiceError } =
      await supabase.rpc("calculate_department_kpis", {
        departamento_nome: departamento,
        start_date: currentStart.toISOString().split("T")[0],
        end_date: currentEnd.toISOString().split("T")[0],
        source_table: "ft",
      });

    if (currentInvoiceError) {
      console.error(
        "❌ [Department KPI] Current invoice error:",
        currentInvoiceError,
      );
      throw currentInvoiceError;
    }

    // Step 5: Fetch previous period invoice KPIs
    const { data: previousInvoiceData, error: previousInvoiceError } =
      await supabase.rpc("calculate_department_kpis", {
        departamento_nome: departamento,
        start_date: previousStart.toISOString().split("T")[0],
        end_date: previousEnd.toISOString().split("T")[0],
        source_table: "2years_ft",
      });

    if (previousInvoiceError) {
      console.error(
        "❌ [Department KPI] Previous invoice error:",
        previousInvoiceError,
      );
      throw previousInvoiceError;
    }

    // Step 6: Fetch current period quote KPIs
    const { data: currentQuoteData, error: currentQuoteError } =
      await supabase.rpc("calculate_department_quotes", {
        departamento_nome: departamento,
        start_date: currentStart.toISOString().split("T")[0],
        end_date: currentEnd.toISOString().split("T")[0],
        source_table: "bo",
      });

    if (currentQuoteError) {
      console.error(
        "❌ [Department KPI] Current quote error:",
        currentQuoteError,
      );
      throw currentQuoteError;
    }

    // Step 7: Fetch previous period quote KPIs
    const { data: previousQuoteData, error: previousQuoteError } =
      await supabase.rpc("calculate_department_quotes", {
        departamento_nome: departamento,
        start_date: previousStart.toISOString().split("T")[0],
        end_date: previousEnd.toISOString().split("T")[0],
        source_table: "2years_bo",
      });

    if (previousQuoteError) {
      console.error(
        "❌ [Department KPI] Previous quote error:",
        previousQuoteError,
      );
      throw previousQuoteError;
    }

    // Step 8: Extract metrics
    const currentInvoice = currentInvoiceData?.[0] || {
      revenue: 0,
      invoice_count: 0,
      customer_count: 0,
      avg_invoice_value: 0,
    };

    const previousInvoice = previousInvoiceData?.[0] || {
      revenue: 0,
      invoice_count: 0,
      customer_count: 0,
      avg_invoice_value: 0,
    };

    const currentQuote = currentQuoteData?.[0] || {
      quote_value: 0,
      quote_count: 0,
    };

    const previousQuote = previousQuoteData?.[0] || {
      quote_value: 0,
      quote_count: 0,
    };

    // Step 9: Calculate derived metrics
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    };

    const currentAvgQuoteValue =
      Number(currentQuote.quote_count) > 0
        ? Number(currentQuote.quote_value) / Number(currentQuote.quote_count)
        : 0;

    const previousAvgQuoteValue =
      Number(previousQuote.quote_count) > 0
        ? Number(previousQuote.quote_value) / Number(previousQuote.quote_count)
        : 0;

    const currentConversionRate =
      Number(currentQuote.quote_count) > 0
        ? (Number(currentInvoice.invoice_count) /
            Number(currentQuote.quote_count)) *
          100
        : 0;

    const previousConversionRate =
      Number(previousQuote.quote_count) > 0
        ? (Number(previousInvoice.invoice_count) /
            Number(previousQuote.quote_count)) *
          100
        : 0;

    // Step 10: Build response matching the KPIDashboardData structure
    const response = {
      [period]: {
        revenue: {
          current: Number(currentInvoice.revenue),
          previous: Number(previousInvoice.revenue),
          change: calculateChange(
            Number(currentInvoice.revenue),
            Number(previousInvoice.revenue),
          ),
        },
        invoices: {
          current: Number(currentInvoice.invoice_count),
          previous: Number(previousInvoice.invoice_count),
          change: calculateChange(
            Number(currentInvoice.invoice_count),
            Number(previousInvoice.invoice_count),
          ),
        },
        customers: {
          current: Number(currentInvoice.customer_count),
          previous: Number(previousInvoice.customer_count),
          change: calculateChange(
            Number(currentInvoice.customer_count),
            Number(previousInvoice.customer_count),
          ),
        },
        avgInvoiceValue: {
          current: Number(currentInvoice.avg_invoice_value),
          previous: Number(previousInvoice.avg_invoice_value),
          change: calculateChange(
            Number(currentInvoice.avg_invoice_value),
            Number(previousInvoice.avg_invoice_value),
          ),
        },
        quoteValue: {
          current: Number(currentQuote.quote_value),
          previous: Number(previousQuote.quote_value),
          change: calculateChange(
            Number(currentQuote.quote_value),
            Number(previousQuote.quote_value),
          ),
        },
        quoteCount: {
          current: Number(currentQuote.quote_count),
          previous: Number(previousQuote.quote_count),
          change: calculateChange(
            Number(currentQuote.quote_count),
            Number(previousQuote.quote_count),
          ),
        },
        conversionRate: {
          current: Math.round(currentConversionRate * 100) / 100,
          previous: Math.round(previousConversionRate * 100) / 100,
          change: calculateChange(
            currentConversionRate,
            previousConversionRate,
          ),
        },
        avgQuoteValue: {
          current: Math.round(currentAvgQuoteValue * 100) / 100,
          previous: Math.round(previousAvgQuoteValue * 100) / 100,
          change: calculateChange(currentAvgQuoteValue, previousAvgQuoteValue),
        },
      },
      generatedAt: new Date().toISOString(),
      departamento,
      period,
    };

    console.log(
      "✅ [Department KPI] Response prepared for",
      departamento,
      period,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [Department KPI] Unexpected Error:", error);
    console.error(
      "❌ [Department KPI] Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    return NextResponse.json(
      {
        error: "Failed to fetch department KPI metrics",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
