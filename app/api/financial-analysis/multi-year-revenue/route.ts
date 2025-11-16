import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/financial-analysis/multi-year-revenue
 *
 * Returns monthly VENDAS (revenue) for:
 * - Current year YTD
 * - Previous year (same-period YTD)
 * - Previous-previous year (same-period YTD)
 *
 * CRITICAL FIX: Uses get_monthly_revenue_breakdown RPC for server-side aggregation
 * to avoid the 1000-row limit from get_invoices_for_period.
 *
 * Rules:
 * - Data sources:
 *   - Current year: phc.ft
 *   - Previous 2 years: phc.2years_ft
 * - Revenue per invoice:
 *   - Use SUM(net_value) directly
 *   - document_type IN ('Factura', 'Nota de Crédito')
 *   - Exclude cancelled: (anulado IS NULL OR anulado != 'True')
 * - YTD alignment:
 *   - For current year Y0: Jan 1 Y0 -> CURRENT_DATE
 *   - For Y1: Jan 1 Y1 -> CURRENT_DATE - 1 year
 *   - For Y2: Jan 1 Y2 -> CURRENT_DATE - 2 years
 *
 * Response:
 * {
 *   years: [Y0, Y1, Y2],
 *   months: ['YYYY-MM', ...] up to current YTD month,
 *   series: [
 *     { year: Y0, points: [{ month: 'YYYY-MM', revenue }, ...] },
 *     { year: Y1, points: [...] },
 *     { year: Y2, points: [...] }
 *   ]
 * }
 */

interface MultiYearRevenuePoint {
  month: string; // YYYY-MM
  revenue: number;
}

interface MultiYearRevenueSeries {
  year: number;
  points: MultiYearRevenuePoint[];
}

interface MultiYearRevenueResponse {
  years: number[];
  months: string[];
  series: MultiYearRevenueSeries[];
}

export async function GET(request: Request) {
  // Step 1: Auth via server client
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 2: Admin client for queries
  const supabase = createAdminClient();

  try {
    const now = new Date();
    const currentYear = now.getFullYear();

    console.log("=== MULTI-YEAR REVENUE API ===");
    console.log("Current Date:", now.toISOString());
    console.log("Current Year:", currentYear);

    // Align end dates by shifting CURRENT_DATE back 1 and 2 years
    const endY0 = now;
    const endY1 = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
    );
    const endY2 = new Date(
      now.getFullYear() - 2,
      now.getMonth(),
      now.getDate(),
    );

    console.log("Date Ranges:");
    console.log(
      `  Y0 (${currentYear}): 2025-01-01 to ${endY0.toISOString().split("T")[0]}`,
    );
    console.log(
      `  Y1 (${currentYear - 1}): 2024-01-01 to ${endY1.toISOString().split("T")[0]}`,
    );
    console.log(
      `  Y2 (${currentYear - 2}): 2023-01-01 to ${endY2.toISOString().split("T")[0]}`,
    );

    // Helper to format YYYY-MM
    const ym = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Build canonical months from Jan of current year up to current month
    const months: string[] = [];
    {
      const currentMonthIndex = now.getMonth(); // 0-based
      for (let m = 0; m <= currentMonthIndex; m++) {
        months.push(`${currentYear}-${String(m + 1).padStart(2, "0")}`);
      }
    }

    // Helper to fetch monthly revenue using server-side aggregation RPC
    // CRITICAL: Uses get_monthly_revenue_breakdown to bypass 1000-row limit
    const fetchYear = async (
      year: number,
      endDate: Date,
    ): Promise<MultiYearRevenueSeries> => {
      // Use aggregation RPC - returns one row per month with pre-calculated totals
      const { data: monthlyData, error } = await supabase.rpc(
        "get_monthly_revenue_breakdown",
        {
          target_year: year,
          end_date: endDate.toISOString().split("T")[0],
        },
      );

      if (error) {
        throw new Error(
          `Failed to load monthly revenue for year ${year}: ${error.message}`,
        );
      }

      console.log(
        `[Year ${year}] RPC returned ${monthlyData.length} month(s):`,
        monthlyData.map((m: { period: string }) => m.period),
      );

      // Convert RPC result to points array
      // RPC returns { period: 'YYYY-MM', net_revenue: number, ... }
      const points: MultiYearRevenuePoint[] = monthlyData
        .map((row) => ({
          month: row.period, // Already in YYYY-MM format
          revenue: Math.round(Number(row.net_revenue || 0)),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      console.log(`[Year ${year}] Revenue summary:`, {
        months: points.length,
        firstMonth: points[0]?.month,
        lastMonth: points[points.length - 1]?.month,
        totalRevenue: points.reduce((sum, p) => sum + p.revenue, 0),
      });

      return { year, points };
    };

    const seriesY0 = await fetchYear(currentYear, endY0);
    const seriesY1 = await fetchYear(currentYear - 1, endY1);
    const seriesY2 = await fetchYear(currentYear - 2, endY2);

    const response: MultiYearRevenueResponse = {
      years: [currentYear, currentYear - 1, currentYear - 2],
      months,
      series: [seriesY0, seriesY1, seriesY2],
    };

    console.log("=== RESPONSE SUMMARY ===");
    console.log("Years:", response.years);
    console.log("Months:", response.months);
    console.log(
      "Series points:",
      response.series.map((s) => ({ year: s.year, points: s.points.length })),
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "[Multi-Year Revenue] Error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      {
        error: "Failed to fetch multi-year revenue data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
