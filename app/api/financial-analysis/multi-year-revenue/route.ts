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

    const startY0 = new Date(currentYear, 0, 1);
    const startY1 = new Date(currentYear - 1, 0, 1);
    const startY2 = new Date(currentYear - 2, 0, 1);

    // Helper to format YYYY-MM
    const ym = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Build canonical months from Jan of current year up to current month
    const months: string[] = [];
    {
      let m = new Date(startY0.getTime());
      m.setDate(1);
      const last = new Date(endY0.getTime());
      last.setDate(1);

      while (m <= last) {
        months.push(ym(m));
        m.setMonth(m.getMonth() + 1);
      }
    }

    // Helper to fetch monthly revenue for a given year using Supabase client directly.
    // Note: Uses server-side admin client with pagination to avoid 1000-record limit.
    const fetchYear = async (
      year: number,
      start: Date,
      end: Date,
      sourceTable: "ft" | "2years_ft",
    ): Promise<MultiYearRevenueSeries> => {
      let allRows: {
        invoice_date: string;
        net_value: number;
        document_type: string;
        anulado: string | null;
      }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .schema("phc")
          .from(sourceTable)
          .select("invoice_date, net_value, document_type, anulado")
          .gte("invoice_date", start.toISOString().split("T")[0])
          .lte("invoice_date", end.toISOString().split("T")[0])
          .order("invoice_date", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          throw new Error(
            `Failed to load monthly revenue for year ${year} from ${sourceTable}: ${error.message}`,
          );
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data as any[]);
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }

      // Aggregate by YYYY-MM with required filters:
      // - document_type IN ('Factura', 'Nota de Crédito')
      // - (anulado IS NULL OR anulado != 'True')
      const monthMap = new Map<string, number>();

      for (const row of allRows) {
        const isValidType =
          row.document_type === "Factura" ||
          row.document_type === "Nota de Crédito";
        const isNotCancelled =
          !row.anulado || row.anulado !== "True";

        if (!isValidType || !isNotCancelled) continue;

        const d = new Date(row.invoice_date);
        const key = `${d.getFullYear()}-${String(
          d.getMonth() + 1,
        ).padStart(2, "0")}`;

        const current = monthMap.get(key) || 0;
        // SUM(net_value) directly; Notas de Crédito already negative
        monthMap.set(key, current + Number(row.net_value || 0));
      }

      // Build points array for this specific year, sorted by month
      // IMPORTANT:
      // - For 2years_ft we store absolute months (2024-01, 2023-01, etc.)
      // - The frontend uses separate keys Vendas_{year} so values will not collide.
      const points: MultiYearRevenuePoint[] = Array.from(monthMap.entries())
        .filter(([key]) => Number(key.slice(0, 4)) === year)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({
          month,
          revenue: Math.round(revenue),
        }));
  
      return { year, points };
    };

    const seriesY0 = await fetchYear(currentYear, startY0, endY0, "ft");
    const seriesY1 = await fetchYear(currentYear - 1, startY1, endY1, "2years_ft");
    const seriesY2 = await fetchYear(currentYear - 2, startY2, endY2, "2years_ft");

    const response: MultiYearRevenueResponse = {
      years: [currentYear, currentYear - 1, currentYear - 2],
      months,
      // IMPORTANT:
      // - seriesY0 points are keyed by YYYY-MM of current year
      // - seriesY1 points are keyed by YYYY-MM of previous year
      // - seriesY2 points are keyed by YYYY-MM of two years ago
      // The frontend maps each year using its own Vendas_{year} key and uses only the
      // months label (short name) on X-axis, so different years do not collide.
      series: [seriesY0, seriesY1, seriesY2],
    };

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