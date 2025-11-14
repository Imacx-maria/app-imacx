import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/financial-analysis/kpi-dashboard
 *
 * Returns executive KPI dashboard metrics with proper YTD accounting:
 * - MTD (Month-to-Date): Current month vs same month previous year
 * - QTD (Quarter-to-Date): Current quarter vs same quarter previous year
 * - YTD (Year-to-Date): Current year vs same period previous year
 *
 * Uses phc.ft for current year, phc.2years_ft for historical comparisons
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
    console.error("❌ [KPI Dashboard] Authentication failed:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("✅ [KPI Dashboard] User authenticated:", user.email);

  // Step 2: Use admin client for database queries
  const supabase = createAdminClient();

  try {
    console.log("📊 [KPI Dashboard] Starting YTD KPI calculation");

    // Get current date and extract components
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = Jan, 10 = Nov)
    const currentQuarter = Math.floor(currentMonth / 3);
    const currentDayOfMonth = now.getDate();

    console.log("📊 [KPI Dashboard] Date context:", {
      today: now.toISOString().split("T")[0],
      currentYear,
      currentMonth: currentMonth + 1,
      currentQuarter: currentQuarter + 1,
      dayOfMonth: currentDayOfMonth,
    });

    // =====================================================================
    // MTD (Month-To-Date) Dates
    // =====================================================================
    // Current: Nov 1-13, 2025
    const mtdCurrentStart = new Date(currentYear, currentMonth, 1);
    const mtdCurrentEnd = now;

    // Previous: Nov 1-13, 2024 (same month, previous year, same day-of-month)
    const mtdPrevStart = new Date(currentYear - 1, currentMonth, 1);
    const mtdPrevEnd = new Date(
      currentYear - 1,
      currentMonth,
      currentDayOfMonth,
    );

    // =====================================================================
    // QTD (Quarter-To-Date) Dates
    // =====================================================================
    // Current: Oct 1 - Nov 13, 2025
    const qtdCurrentStart = new Date(currentYear, currentQuarter * 3, 1);
    const qtdCurrentEnd = now;

    // Previous: Oct 1 - Nov 13, 2024 (same quarter, previous year)
    const qtdPrevStart = new Date(currentYear - 1, currentQuarter * 3, 1);
    const qtdPrevEnd = new Date(
      currentYear - 1,
      currentMonth,
      currentDayOfMonth,
    );

    // =====================================================================
    // YTD (Year-To-Date) Dates
    // =====================================================================
    // Current: Jan 1 - Nov 13, 2025
    const ytdCurrentStart = new Date(currentYear, 0, 1);
    const ytdCurrentEnd = now;

    // Previous: Jan 1 - Nov 13, 2024 (same period, previous year)
    const ytdPrevStart = new Date(currentYear - 1, 0, 1);
    const ytdPrevEnd = new Date(
      currentYear - 1,
      currentMonth,
      currentDayOfMonth,
    );

    console.log("📊 [KPI Dashboard] YTD Date Ranges:", {
      mtd_current: `${mtdCurrentStart.toISOString().split("T")[0]} → ${mtdCurrentEnd.toISOString().split("T")[0]}`,
      mtd_previous: `${mtdPrevStart.toISOString().split("T")[0]} → ${mtdPrevEnd.toISOString().split("T")[0]}`,
      qtd_current: `${qtdCurrentStart.toISOString().split("T")[0]} → ${qtdCurrentEnd.toISOString().split("T")[0]}`,
      qtd_previous: `${qtdPrevStart.toISOString().split("T")[0]} → ${qtdPrevEnd.toISOString().split("T")[0]}`,
      ytd_current: `${ytdCurrentStart.toISOString().split("T")[0]} → ${ytdCurrentEnd.toISOString().split("T")[0]}`,
      ytd_previous: `${ytdPrevStart.toISOString().split("T")[0]} → ${ytdPrevEnd.toISOString().split("T")[0]}`,
    });

    // =====================================================================
    // Fetch MTD Current (from phc.ft - current year) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching MTD current via RPC");
    const { data: mtdCurrent, error: mtdCurrentError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: mtdCurrentStart.toISOString().split("T")[0],
        end_date: mtdCurrentEnd.toISOString().split("T")[0],
        source_table: "ft",
      },
    );

    if (mtdCurrentError) {
      console.error("❌ [KPI Dashboard] MTD Current Error:", mtdCurrentError);
      return NextResponse.json(
        { error: `MTD current query failed: ${mtdCurrentError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] MTD current: revenue=${mtdCurrent?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch MTD Previous (from phc.2years_ft - historical) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching MTD previous via RPC");
    const { data: mtdPrevious, error: mtdPrevError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: mtdPrevStart.toISOString().split("T")[0],
        end_date: mtdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_ft",
      },
    );

    if (mtdPrevError) {
      console.error("❌ [KPI Dashboard] MTD Previous Error:", mtdPrevError);
      return NextResponse.json(
        { error: `MTD previous query failed: ${mtdPrevError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] MTD previous: revenue=${mtdPrevious?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch QTD Current (from phc.ft - current year) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching QTD current via RPC");
    const { data: qtdCurrent, error: qtdCurrentError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: qtdCurrentStart.toISOString().split("T")[0],
        end_date: qtdCurrentEnd.toISOString().split("T")[0],
        source_table: "ft",
      },
    );

    if (qtdCurrentError) {
      console.error("❌ [KPI Dashboard] QTD Current Error:", qtdCurrentError);
      return NextResponse.json(
        { error: `QTD current query failed: ${qtdCurrentError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] QTD current: revenue=${qtdCurrent?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch QTD Previous (from phc.2years_ft - historical) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching QTD previous via RPC");
    const { data: qtdPrevious, error: qtdPrevError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: qtdPrevStart.toISOString().split("T")[0],
        end_date: qtdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_ft",
      },
    );

    if (qtdPrevError) {
      console.error("❌ [KPI Dashboard] QTD Previous Error:", qtdPrevError);
      return NextResponse.json(
        { error: `QTD previous query failed: ${qtdPrevError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] QTD previous: revenue=${qtdPrevious?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch YTD Current (from phc.ft - current year) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching YTD current via RPC");
    const { data: ytdCurrent, error: ytdCurrentError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: ytdCurrentStart.toISOString().split("T")[0],
        end_date: ytdCurrentEnd.toISOString().split("T")[0],
        source_table: "ft",
      },
    );

    if (ytdCurrentError) {
      console.error("❌ [KPI Dashboard] YTD Current Error:", ytdCurrentError);
      return NextResponse.json(
        { error: `YTD current query failed: ${ytdCurrentError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] YTD current: revenue=${ytdCurrent?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch YTD Previous (from phc.2years_ft - historical) via RPC
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching YTD previous via RPC");
    const { data: ytdPrevious, error: ytdPrevError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: ytdPrevStart.toISOString().split("T")[0],
        end_date: ytdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_ft",
      },
    );

    if (ytdPrevError) {
      console.error("❌ [KPI Dashboard] YTD Previous Error:", ytdPrevError);
      return NextResponse.json(
        { error: `YTD previous query failed: ${ytdPrevError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `✅ [KPI Dashboard] YTD previous: revenue=${ytdPrevious?.[0]?.revenue || 0}`,
    );

    // =====================================================================
    // Fetch Quotes/Orçamentos Data (MTD/QTD/YTD)
    // =====================================================================
    console.log("📊 [KPI Dashboard] Fetching quotes data via RPC");

    // MTD Quotes Current
    const { data: mtdQuotesCurrent, error: mtdQuotesCurrentError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: mtdCurrentStart.toISOString().split("T")[0],
        end_date: mtdCurrentEnd.toISOString().split("T")[0],
        source_table: "bo",
      });

    if (mtdQuotesCurrentError) {
      console.error(
        "❌ [KPI Dashboard] MTD Quotes Current Error:",
        mtdQuotesCurrentError,
      );
    }

    // MTD Quotes Previous
    const { data: mtdQuotesPrevious, error: mtdQuotesPreviousError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: mtdPrevStart.toISOString().split("T")[0],
        end_date: mtdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_bo",
      });

    if (mtdQuotesPreviousError) {
      console.error(
        "❌ [KPI Dashboard] MTD Quotes Previous Error:",
        mtdQuotesPreviousError,
      );
    }

    // QTD Quotes Current
    const { data: qtdQuotesCurrent, error: qtdQuotesCurrentError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: qtdCurrentStart.toISOString().split("T")[0],
        end_date: qtdCurrentEnd.toISOString().split("T")[0],
        source_table: "bo",
      });

    if (qtdQuotesCurrentError) {
      console.error(
        "❌ [KPI Dashboard] QTD Quotes Current Error:",
        qtdQuotesCurrentError,
      );
    }

    // QTD Quotes Previous
    const { data: qtdQuotesPrevious, error: qtdQuotesPreviousError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: qtdPrevStart.toISOString().split("T")[0],
        end_date: qtdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_bo",
      });

    if (qtdQuotesPreviousError) {
      console.error(
        "❌ [KPI Dashboard] QTD Quotes Previous Error:",
        qtdQuotesPreviousError,
      );
    }

    // YTD Quotes Current
    const { data: ytdQuotesCurrent, error: ytdQuotesCurrentError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: ytdCurrentStart.toISOString().split("T")[0],
        end_date: ytdCurrentEnd.toISOString().split("T")[0],
        source_table: "bo",
      });

    if (ytdQuotesCurrentError) {
      console.error(
        "❌ [KPI Dashboard] YTD Quotes Current Error:",
        ytdQuotesCurrentError,
      );
    }

    // YTD Quotes Previous
    const { data: ytdQuotesPrevious, error: ytdQuotesPreviousError } =
      await supabase.rpc("calculate_ytd_quotes", {
        start_date: ytdPrevStart.toISOString().split("T")[0],
        end_date: ytdPrevEnd.toISOString().split("T")[0],
        source_table: "2years_bo",
      });

    if (ytdQuotesPreviousError) {
      console.error(
        "❌ [KPI Dashboard] YTD Quotes Previous Error:",
        ytdQuotesPreviousError,
      );
    }

    console.log("✅ [KPI Dashboard] Quotes data fetched");

    // =====================================================================
    // Extract Metrics from RPC Results
    // =====================================================================
    // Invoice metrics
    const mtdCurrentMetrics = {
      revenue: Number(mtdCurrent?.[0]?.revenue || 0),
      invoices: Number(mtdCurrent?.[0]?.invoice_count || 0),
      customers: Number(mtdCurrent?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(mtdCurrent?.[0]?.avg_invoice_value || 0),
    };

    const mtdPreviousMetrics = {
      revenue: Number(mtdPrevious?.[0]?.revenue || 0),
      invoices: Number(mtdPrevious?.[0]?.invoice_count || 0),
      customers: Number(mtdPrevious?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(mtdPrevious?.[0]?.avg_invoice_value || 0),
    };

    const qtdCurrentMetrics = {
      revenue: Number(qtdCurrent?.[0]?.revenue || 0),
      invoices: Number(qtdCurrent?.[0]?.invoice_count || 0),
      customers: Number(qtdCurrent?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(qtdCurrent?.[0]?.avg_invoice_value || 0),
    };

    const qtdPreviousMetrics = {
      revenue: Number(qtdPrevious?.[0]?.revenue || 0),
      invoices: Number(qtdPrevious?.[0]?.invoice_count || 0),
      customers: Number(qtdPrevious?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(qtdPrevious?.[0]?.avg_invoice_value || 0),
    };

    const ytdCurrentMetrics = {
      revenue: Number(ytdCurrent?.[0]?.revenue || 0),
      invoices: Number(ytdCurrent?.[0]?.invoice_count || 0),
      customers: Number(ytdCurrent?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(ytdCurrent?.[0]?.avg_invoice_value || 0),
    };

    const ytdPreviousMetrics = {
      revenue: Number(ytdPrevious?.[0]?.revenue || 0),
      invoices: Number(ytdPrevious?.[0]?.invoice_count || 0),
      customers: Number(ytdPrevious?.[0]?.customer_count || 0),
      avgInvoiceValue: Number(ytdPrevious?.[0]?.avg_invoice_value || 0),
    };

    // Quote metrics
    const mtdQuotesCurrentMetrics = {
      quoteValue: Number(mtdQuotesCurrent?.[0]?.quote_value || 0),
      quoteCount: Number(mtdQuotesCurrent?.[0]?.quote_count || 0),
    };

    const mtdQuotesPreviousMetrics = {
      quoteValue: Number(mtdQuotesPrevious?.[0]?.quote_value || 0),
      quoteCount: Number(mtdQuotesPrevious?.[0]?.quote_count || 0),
    };

    const qtdQuotesCurrentMetrics = {
      quoteValue: Number(qtdQuotesCurrent?.[0]?.quote_value || 0),
      quoteCount: Number(qtdQuotesCurrent?.[0]?.quote_count || 0),
    };

    const qtdQuotesPreviousMetrics = {
      quoteValue: Number(qtdQuotesPrevious?.[0]?.quote_value || 0),
      quoteCount: Number(qtdQuotesPrevious?.[0]?.quote_count || 0),
    };

    const ytdQuotesCurrentMetrics = {
      quoteValue: Number(ytdQuotesCurrent?.[0]?.quote_value || 0),
      quoteCount: Number(ytdQuotesCurrent?.[0]?.quote_count || 0),
    };

    const ytdQuotesPreviousMetrics = {
      quoteValue: Number(ytdQuotesPrevious?.[0]?.quote_value || 0),
      quoteCount: Number(ytdQuotesPrevious?.[0]?.quote_count || 0),
    };

    // Average Quote Values (Orçamento Médio)
    const mtdAvgQuoteValueCurrent =
      mtdQuotesCurrentMetrics.quoteCount > 0
        ? mtdQuotesCurrentMetrics.quoteValue /
          mtdQuotesCurrentMetrics.quoteCount
        : 0;

    const mtdAvgQuoteValuePrevious =
      mtdQuotesPreviousMetrics.quoteCount > 0
        ? mtdQuotesPreviousMetrics.quoteValue /
          mtdQuotesPreviousMetrics.quoteCount
        : 0;

    const qtdAvgQuoteValueCurrent =
      qtdQuotesCurrentMetrics.quoteCount > 0
        ? qtdQuotesCurrentMetrics.quoteValue /
          qtdQuotesCurrentMetrics.quoteCount
        : 0;

    const qtdAvgQuoteValuePrevious =
      qtdQuotesPreviousMetrics.quoteCount > 0
        ? qtdQuotesPreviousMetrics.quoteValue /
          qtdQuotesPreviousMetrics.quoteCount
        : 0;

    const ytdAvgQuoteValueCurrent =
      ytdQuotesCurrentMetrics.quoteCount > 0
        ? ytdQuotesCurrentMetrics.quoteValue /
          ytdQuotesCurrentMetrics.quoteCount
        : 0;

    const ytdAvgQuoteValuePrevious =
      ytdQuotesPreviousMetrics.quoteCount > 0
        ? ytdQuotesPreviousMetrics.quoteValue /
          ytdQuotesPreviousMetrics.quoteCount
        : 0;

    // Conversion rates (Invoices / Quotes * 100)
    const mtdConversionRateCurrent =
      mtdQuotesCurrentMetrics.quoteCount > 0
        ? (mtdCurrentMetrics.invoices / mtdQuotesCurrentMetrics.quoteCount) *
          100
        : 0;

    const mtdConversionRatePrevious =
      mtdQuotesPreviousMetrics.quoteCount > 0
        ? (mtdPreviousMetrics.invoices / mtdQuotesPreviousMetrics.quoteCount) *
          100
        : 0;

    const qtdConversionRateCurrent =
      qtdQuotesCurrentMetrics.quoteCount > 0
        ? (qtdCurrentMetrics.invoices / qtdQuotesCurrentMetrics.quoteCount) *
          100
        : 0;

    const qtdConversionRatePrevious =
      qtdQuotesPreviousMetrics.quoteCount > 0
        ? (qtdPreviousMetrics.invoices / qtdQuotesPreviousMetrics.quoteCount) *
          100
        : 0;

    const ytdConversionRateCurrent =
      ytdQuotesCurrentMetrics.quoteCount > 0
        ? (ytdCurrentMetrics.invoices / ytdQuotesCurrentMetrics.quoteCount) *
          100
        : 0;

    const ytdConversionRatePrevious =
      ytdQuotesPreviousMetrics.quoteCount > 0
        ? (ytdPreviousMetrics.invoices / ytdQuotesPreviousMetrics.quoteCount) *
          100
        : 0;

    console.log("📊 [KPI Dashboard] MTD Current:", mtdCurrentMetrics);
    console.log("📊 [KPI Dashboard] MTD Previous:", mtdPreviousMetrics);
    console.log("📊 [KPI Dashboard] QTD Current:", qtdCurrentMetrics);
    console.log("📊 [KPI Dashboard] QTD Previous:", qtdPreviousMetrics);
    console.log("📊 [KPI Dashboard] YTD Current:", ytdCurrentMetrics);
    console.log("📊 [KPI Dashboard] YTD Previous:", ytdPreviousMetrics);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    };

    // Build response
    const response = {
      mtd: {
        revenue: {
          current: mtdCurrentMetrics.revenue,
          previous: mtdPreviousMetrics.revenue,
          change: calculateChange(
            mtdCurrentMetrics.revenue,
            mtdPreviousMetrics.revenue,
          ),
        },
        invoices: {
          current: mtdCurrentMetrics.invoices,
          previous: mtdPreviousMetrics.invoices,
          change: calculateChange(
            mtdCurrentMetrics.invoices,
            mtdPreviousMetrics.invoices,
          ),
        },
        customers: {
          current: mtdCurrentMetrics.customers,
          previous: mtdPreviousMetrics.customers,
          change: calculateChange(
            mtdCurrentMetrics.customers,
            mtdPreviousMetrics.customers,
          ),
        },
        avgInvoiceValue: {
          current: mtdCurrentMetrics.avgInvoiceValue,
          previous: mtdPreviousMetrics.avgInvoiceValue,
          change: calculateChange(
            mtdCurrentMetrics.avgInvoiceValue,
            mtdPreviousMetrics.avgInvoiceValue,
          ),
        },
        quoteValue: {
          current: mtdQuotesCurrentMetrics.quoteValue,
          previous: mtdQuotesPreviousMetrics.quoteValue,
          change: calculateChange(
            mtdQuotesCurrentMetrics.quoteValue,
            mtdQuotesPreviousMetrics.quoteValue,
          ),
        },
        quoteCount: {
          current: mtdQuotesCurrentMetrics.quoteCount,
          previous: mtdQuotesPreviousMetrics.quoteCount,
          change: calculateChange(
            mtdQuotesCurrentMetrics.quoteCount,
            mtdQuotesPreviousMetrics.quoteCount,
          ),
        },
        conversionRate: {
          current: Math.round(mtdConversionRateCurrent * 100) / 100,
          previous: Math.round(mtdConversionRatePrevious * 100) / 100,
          change: calculateChange(
            mtdConversionRateCurrent,
            mtdConversionRatePrevious,
          ),
        },
        avgQuoteValue: {
          current: Math.round(mtdAvgQuoteValueCurrent * 100) / 100,
          previous: Math.round(mtdAvgQuoteValuePrevious * 100) / 100,
          change: calculateChange(
            mtdAvgQuoteValueCurrent,
            mtdAvgQuoteValuePrevious,
          ),
        },
      },
      qtd: {
        revenue: {
          current: qtdCurrentMetrics.revenue,
          previous: qtdPreviousMetrics.revenue,
          change: calculateChange(
            qtdCurrentMetrics.revenue,
            qtdPreviousMetrics.revenue,
          ),
        },
        invoices: {
          current: qtdCurrentMetrics.invoices,
          previous: qtdPreviousMetrics.invoices,
          change: calculateChange(
            qtdCurrentMetrics.invoices,
            qtdPreviousMetrics.invoices,
          ),
        },
        customers: {
          current: qtdCurrentMetrics.customers,
          previous: qtdPreviousMetrics.customers,
          change: calculateChange(
            qtdCurrentMetrics.customers,
            qtdPreviousMetrics.customers,
          ),
        },
        avgInvoiceValue: {
          current: qtdCurrentMetrics.avgInvoiceValue,
          previous: qtdPreviousMetrics.avgInvoiceValue,
          change: calculateChange(
            qtdCurrentMetrics.avgInvoiceValue,
            qtdPreviousMetrics.avgInvoiceValue,
          ),
        },
        quoteValue: {
          current: qtdQuotesCurrentMetrics.quoteValue,
          previous: qtdQuotesPreviousMetrics.quoteValue,
          change: calculateChange(
            qtdQuotesCurrentMetrics.quoteValue,
            qtdQuotesPreviousMetrics.quoteValue,
          ),
        },
        quoteCount: {
          current: qtdQuotesCurrentMetrics.quoteCount,
          previous: qtdQuotesPreviousMetrics.quoteCount,
          change: calculateChange(
            qtdQuotesCurrentMetrics.quoteCount,
            qtdQuotesPreviousMetrics.quoteCount,
          ),
        },
        conversionRate: {
          current: Math.round(qtdConversionRateCurrent * 100) / 100,
          previous: Math.round(qtdConversionRatePrevious * 100) / 100,
          change: calculateChange(
            qtdConversionRateCurrent,
            qtdConversionRatePrevious,
          ),
        },
        avgQuoteValue: {
          current: Math.round(qtdAvgQuoteValueCurrent * 100) / 100,
          previous: Math.round(qtdAvgQuoteValuePrevious * 100) / 100,
          change: calculateChange(
            qtdAvgQuoteValueCurrent,
            qtdAvgQuoteValuePrevious,
          ),
        },
      },
      ytd: {
        revenue: {
          current: ytdCurrentMetrics.revenue,
          previous: ytdPreviousMetrics.revenue,
          change: calculateChange(
            ytdCurrentMetrics.revenue,
            ytdPreviousMetrics.revenue,
          ),
        },
        invoices: {
          current: ytdCurrentMetrics.invoices,
          previous: ytdPreviousMetrics.invoices,
          change: calculateChange(
            ytdCurrentMetrics.invoices,
            ytdPreviousMetrics.invoices,
          ),
        },
        customers: {
          current: ytdCurrentMetrics.customers,
          previous: ytdPreviousMetrics.customers,
          change: calculateChange(
            ytdCurrentMetrics.customers,
            ytdPreviousMetrics.customers,
          ),
        },
        avgInvoiceValue: {
          current: ytdCurrentMetrics.avgInvoiceValue,
          previous: ytdPreviousMetrics.avgInvoiceValue,
          change: calculateChange(
            ytdCurrentMetrics.avgInvoiceValue,
            ytdPreviousMetrics.avgInvoiceValue,
          ),
        },
        quoteValue: {
          current: ytdQuotesCurrentMetrics.quoteValue,
          previous: ytdQuotesPreviousMetrics.quoteValue,
          change: calculateChange(
            ytdQuotesCurrentMetrics.quoteValue,
            ytdQuotesPreviousMetrics.quoteValue,
          ),
        },
        quoteCount: {
          current: ytdQuotesCurrentMetrics.quoteCount,
          previous: ytdQuotesPreviousMetrics.quoteCount,
          change: calculateChange(
            ytdQuotesCurrentMetrics.quoteCount,
            ytdQuotesPreviousMetrics.quoteCount,
          ),
        },
        conversionRate: {
          current: Math.round(ytdConversionRateCurrent * 100) / 100,
          previous: Math.round(ytdConversionRatePrevious * 100) / 100,
          change: calculateChange(
            ytdConversionRateCurrent,
            ytdConversionRatePrevious,
          ),
        },
        avgQuoteValue: {
          current: Math.round(ytdAvgQuoteValueCurrent * 100) / 100,
          previous: Math.round(ytdAvgQuoteValuePrevious * 100) / 100,
          change: calculateChange(
            ytdAvgQuoteValueCurrent,
            ytdAvgQuoteValuePrevious,
          ),
        },
      },
      generatedAt: new Date().toISOString(),
    };

    console.log("✅ [KPI Dashboard] YTD Response prepared successfully");
    console.log("📊 [KPI Dashboard] YTD 2025:", ytdCurrentMetrics);
    console.log("📊 [KPI Dashboard] YTD 2024:", ytdPreviousMetrics);

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [KPI Dashboard] Unexpected Error:", error);
    console.error(
      "❌ [KPI Dashboard] Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    return NextResponse.json(
      {
        error: "Failed to fetch KPI metrics",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
