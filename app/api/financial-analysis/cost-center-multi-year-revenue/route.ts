import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/financial-analysis/cost-center-multi-year-revenue
 *
 * Returns monthly revenue breakdown by cost center for 3 years (current, previous, 2 years ago)
 * Similar to multi-year-revenue but filtered by cost center
 *
 * Query params:
 * - costCenter: optional, filter by specific cost center (e.g., "ID-Impressão Digital")
 */
export async function GET(request: Request) {
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

  // Step 2: Parse query params
  const { searchParams } = new URL(request.url);
  const costCenter = searchParams.get("costCenter");

  // Step 3: Query with admin client
  const supabase = createAdminClient();

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    console.log("=== COST CENTER MULTI-YEAR REVENUE API ===");
    console.log("Cost Center:", costCenter || "ALL");
    console.log("Years:", years);

    // Build results for each year using get_cost_center_monthly RPC
    const seriesData: {
      year: number;
      points: { month: string; revenue: number }[];
    }[] = [];

    for (const year of years) {
      const isCurrentYear = year === currentYear;
      const sourceTable = isCurrentYear ? "ft" : "2years_ft";

      // Date range for the year - align YTD properly
      const startDate = `${year}-01-01`;
      const endDate = isCurrentYear
        ? now.toISOString().split("T")[0]
        : new Date(year, now.getMonth(), now.getDate())
            .toISOString()
            .split("T")[0];

      console.log(
        `[Year ${year}] Fetching ${startDate} to ${endDate} from ${sourceTable}`,
      );

      // Use the existing get_cost_center_monthly RPC
      const { data: monthlyData, error: monthlyError } = await supabase.rpc(
        "get_cost_center_monthly",
        {
          start_date: startDate,
          end_date: endDate,
          source_table: sourceTable,
        },
      );

      if (monthlyError) {
        console.error(`Monthly RPC failed for ${year}:`, monthlyError);
        seriesData.push({ year, points: [] });
        continue;
      }

      // Filter by cost center if specified
      const filteredData = costCenter
        ? (monthlyData || []).filter((r: any) => r.cost_center === costCenter)
        : monthlyData || [];

      // Group by month and sum revenue (in case of multiple cost centers when no filter)
      // RPC returns month as DATE (e.g., "2024-01-01T00:00:00"), convert to YYYY-MM
      const monthlyMap = new Map<string, number>();
      for (const row of filteredData) {
        let monthStr = row.month;
        if (monthStr && typeof monthStr === "string") {
          // If it's a full date like "2024-01-01" or "2024-01-01T00:00:00", extract YYYY-MM
          if (monthStr.length >= 10) {
            monthStr = monthStr.substring(0, 7); // "2024-01-01" -> "2024-01"
          }
        }
        if (monthStr) {
          const current = monthlyMap.get(monthStr) || 0;
          monthlyMap.set(monthStr, current + (parseFloat(row.revenue) || 0));
        }
      }

      const points = Array.from(monthlyMap.entries())
        .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }))
        .sort((a, b) => a.month.localeCompare(b.month));

      console.log(
        `[Year ${year}] Found ${points.length} months, total revenue: ${points.reduce((s, p) => s + p.revenue, 0)}`,
      );

      seriesData.push({ year, points });
    }

    // Get list of all cost centers for the filter dropdown
    const costCenters = [
      "ID-Impressão Digital",
      "BR-Brindes",
      "IO-Impressão OFFSET",
    ];

    // Build months array from current year
    const months: string[] = [];
    const currentMonthIndex = now.getMonth();
    for (let m = 0; m <= currentMonthIndex; m++) {
      months.push(`${currentYear}-${String(m + 1).padStart(2, "0")}`);
    }

    console.log("=== RESPONSE SUMMARY ===");
    console.log("Months:", months.length);
    console.log(
      "Series:",
      seriesData.map((s) => ({ year: s.year, points: s.points.length })),
    );

    return NextResponse.json({
      years,
      months,
      series: seriesData,
      costCenters,
      selectedCostCenter: costCenter || null,
      metadata: {
        generatedAt: new Date().toISOString(),
        currentYear,
        dataSource: "phc.ft + phc.2years_ft via get_cost_center_monthly RPC",
      },
    });
  } catch (error) {
    console.error("❌ Error in cost-center-multi-year-revenue:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
