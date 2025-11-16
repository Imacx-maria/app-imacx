import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/financial-analysis/monthly-revenue
 *
 * Returns monthly revenue analysis for current year YTD:
 * - Monthly breakdown from January to current month
 * - Total invoices per month (Factura + Nota de Crédito)
 * - Valid invoices (Factura only)
 * - Net revenue (Factura + Nota de Crédito)
 * - Average invoice value
 *
 * Uses RPC function get_monthly_revenue_breakdown for secure access
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

  // Step 2: Use admin client for database queries
  const supabase = createAdminClient();

  try {
    // Calculate current year YTD dates
    const now = new Date();
    const currentYear = now.getFullYear();

    console.log("📊 [Monthly Revenue] Fetching YTD data:", {
      year: currentYear,
      start: `${currentYear}-01-01`,
      end: now.toISOString().split("T")[0],
    });

    // Use RPC function to get monthly breakdown
    const { data: monthlyResults, error: monthlyError } = await supabase.rpc(
      "get_monthly_revenue_breakdown",
      {
        target_year: currentYear,
        end_date: now.toISOString().split("T")[0],
      },
    );

    if (monthlyError) {
      console.error("❌ [Monthly Revenue] Query Error:", monthlyError);
      return NextResponse.json(
        { error: monthlyError.message },
        { status: 500 },
      );
    }

    console.log(
      `✅ [Monthly Revenue] Fetched ${monthlyResults?.length || 0} months of data`,
    );

    // Calculate summary statistics for current year
    const totals = (monthlyResults || []).reduce(
      (
        acc: {
          totalInvoices: number;
          validInvoices: number;
          netRevenue: number;
          grossRevenue: number;
        },
        month: any,
      ) => ({
        totalInvoices: acc.totalInvoices + Number(month.total_invoices || 0),
        validInvoices: acc.validInvoices + Number(month.valid_invoices || 0),
        netRevenue: acc.netRevenue + Number(month.net_revenue || 0),
        grossRevenue: acc.grossRevenue + Number(month.gross_revenue || 0),
      }),
      {
        totalInvoices: 0,
        validInvoices: 0,
        netRevenue: 0,
        grossRevenue: 0,
      },
    );

    const overallAvgInvoiceValue =
      totals.validInvoices > 0
        ? Math.round((totals.netRevenue / totals.validInvoices) * 100) / 100
        : 0;

    const response = {
      monthlyData: monthlyResults || [],
      summary: {
        totalInvoices: totals.totalInvoices,
        validInvoices: totals.validInvoices,
        netRevenue: Math.round(totals.netRevenue * 100) / 100,
        grossRevenue: Math.round(totals.grossRevenue * 100) / 100,
        avgInvoiceValue: overallAvgInvoiceValue,
        cancellationRate: 0, // Not calculated
      },
      metadata: {
        year: currentYear,
        startDate: `${currentYear}-01-01`,
        endDate: now.toISOString().split("T")[0],
        monthsAnalyzed: monthlyResults?.length || 0,
        generatedAt: new Date().toISOString(),
      },
    };

    console.log(
      `✅ [Monthly Revenue] Summary: ${totals.validInvoices} invoices, €${totals.netRevenue.toFixed(2)}`,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [Monthly Revenue] Unexpected Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly revenue data" },
      { status: 500 },
    );
  }
}
