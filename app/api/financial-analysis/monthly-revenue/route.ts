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
 * Uses phc.ft for current year data only
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
    const ytdStart = new Date(currentYear, 0, 1); // January 1 of current year
    const ytdEnd = now; // Today

    console.log("📊 [Monthly Revenue] Fetching YTD data:", {
      year: currentYear,
      start: ytdStart.toISOString().split("T")[0],
      end: ytdEnd.toISOString().split("T")[0],
    });

    // Fetch ALL invoice data from phc.ft using pagination (bypass 1000 limit)
    let allInvoiceData: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log("📊 [Monthly Revenue] Starting paginated fetch...");

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .schema("phc")
        .from("ft")
        .select("invoice_id, invoice_date, net_value, document_type, anulado")
        .gte("invoice_date", ytdStart.toISOString().split("T")[0])
        .lte("invoice_date", ytdEnd.toISOString().split("T")[0])
        .order("invoice_date", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        console.error("❌ [Monthly Revenue] Query Error:", batchError);
        return NextResponse.json(
          { error: batchError.message },
          { status: 500 },
        );
      }

      if (batch && batch.length > 0) {
        allInvoiceData = allInvoiceData.concat(batch);
        offset += batchSize;
        hasMore = batch.length === batchSize;
        console.log(
          `📊 [Monthly Revenue] Fetched batch: ${batch.length} records (total: ${allInvoiceData.length})`,
        );
      } else {
        hasMore = false;
      }
    }

    const invoiceData = allInvoiceData;

    console.log(
      `✅ [Monthly Revenue] Fetched ${invoiceData?.length || 0} total records`,
    );

    // Filter out cancelled invoices and invalid document types
    const validInvoices = (invoiceData || []).filter((inv) => {
      const isNotCancelled = !inv.anulado || inv.anulado !== "True";
      const isValidType =
        inv.document_type === "Factura" ||
        inv.document_type === "Nota de Crédito";
      return isNotCancelled && isValidType;
    });

    console.log(
      `✅ [Monthly Revenue] Valid records after filtering: ${validInvoices.length}`,
    );

    // Group data by month
    const monthlyData = new Map<
      string,
      {
        totalInvoices: number;
        validInvoices: number;
        netRevenue: number;
        grossRevenue: number;
      }
    >();

    // Process each invoice
    for (const invoice of validInvoices) {
      // Extract year-month (YYYY-MM format)
      const invoiceDate = new Date(invoice.invoice_date);
      const yearMonth = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, "0")}`;

      // Initialize month data if not exists
      if (!monthlyData.has(yearMonth)) {
        monthlyData.set(yearMonth, {
          totalInvoices: 0,
          validInvoices: 0,
          netRevenue: 0,
          grossRevenue: 0,
        });
      }

      const monthData = monthlyData.get(yearMonth)!;
      const value = Number(invoice.net_value) || 0;

      // Revenue calculation: Factura (positive) - Nota de Crédito (negative)
      // Cancelled invoices already filtered out
      const isFactura = invoice.document_type === "Factura";
      const isNotaCredito = invoice.document_type === "Nota de Crédito";

      if (isFactura) {
        monthData.totalInvoices++;
        monthData.validInvoices++;
        monthData.netRevenue += value;
        monthData.grossRevenue += value;
      } else if (isNotaCredito) {
        monthData.totalInvoices++;
        monthData.netRevenue -= value; // Subtract credit notes
        monthData.grossRevenue += value; // Gross includes credits as positive
      }
    }

    // Convert map to array and calculate derived metrics
    const monthlyResults = Array.from(monthlyData.entries())
      .map(([period, data]) => {
        const avgInvoiceValue =
          data.validInvoices > 0
            ? Math.round((data.netRevenue / data.validInvoices) * 100) / 100
            : 0;

        return {
          period,
          totalInvoices: data.totalInvoices,
          validInvoices: data.validInvoices,
          netRevenue: Math.round(data.netRevenue * 100) / 100,
          grossRevenue: Math.round(data.grossRevenue * 100) / 100,
          avgInvoiceValue,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period)); // Sort ascending (Jan to Nov)

    // Calculate summary statistics for current year
    const totals = monthlyResults.reduce(
      (acc, month) => ({
        totalInvoices: acc.totalInvoices + month.totalInvoices,
        validInvoices: acc.validInvoices + month.validInvoices,
        netRevenue: acc.netRevenue + month.netRevenue,
        grossRevenue: acc.grossRevenue + month.grossRevenue,
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
      monthlyData: monthlyResults,
      summary: {
        totalInvoices: totals.totalInvoices,
        validInvoices: totals.validInvoices,
        netRevenue: Math.round(totals.netRevenue * 100) / 100,
        grossRevenue: Math.round(totals.grossRevenue * 100) / 100,
        avgInvoiceValue: overallAvgInvoiceValue,
        cancellationRate: 0, // Not calculated (no anulado data)
      },
      metadata: {
        year: currentYear,
        startDate: ytdStart.toISOString().split("T")[0],
        endDate: ytdEnd.toISOString().split("T")[0],
        monthsAnalyzed: monthlyResults.length,
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
