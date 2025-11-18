import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fixEncoding } from "@/utils/encodingHelpers";

/**
 * GET /api/financial-analysis/top-customers
 *
 * Returns top customers YTD analysis including:
 * - Customer name, city, salesperson
 * - Invoice count
 * - Net revenue (excluding cancelled invoices)
 * - Cancelled revenue
 * - Revenue share percentage
 * - First and last invoice dates
 * - Days since last invoice
 */
export async function GET(request: Request) {
  // Validate authentication using server client with cookies
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client for database queries
  const supabase = createAdminClient();

  try {
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 20;
    const periodParam = searchParams.get("period"); // 'ytd', '12months', 'mtd'
    const period = periodParam || "ytd";

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "12months":
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      case "mtd":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = now.toISOString().split("T")[0];

    // Use aggregated RPC function to get customer metrics (avoids 1000 row limit)
    // This aggregates at database level, returning one row per customer
    const { data: customerMetrics, error: currentError } = await supabase.rpc(
      "get_aggregated_top_customers",
      {
        start_date: startStr,
        end_date: endStr,
        use_historical: false,
      },
    );

    if (currentError) {
      console.error(`❌ [Top Customers] Query error:`, currentError);
      throw currentError;
    }

    console.log(
      `✅ [Top Customers] Fetched ${customerMetrics?.length || 0} aggregated customer records`,
    );

    // Previous-year YTD window (for YTD only) from phc.2years_ft
    let prevMetrics: any[] = [];
    if (period === "ytd") {
      const prevStart = new Date(startDate);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(now);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const prevStartStr = prevStart.toISOString().split("T")[0];
      const prevEndStr = prevEnd.toISOString().split("T")[0];

      const { data: prevData, error: prevError } = await supabase.rpc(
        "get_aggregated_top_customers",
        {
          start_date: prevStartStr,
          end_date: prevEndStr,
          use_historical: true,
        },
      );

      if (prevError) {
        console.error(
          `❌ [Top Customers] Query error on previous year:`,
          prevError,
        );
        throw prevError;
      }

      prevMetrics = prevData || [];
    }

    if (!customerMetrics || customerMetrics.length === 0) {
      return NextResponse.json({
        customers: [],
        summary: {
          totalCustomers: 0,
          totalRevenue: 0,
          totalInvoices: 0,
        },
        metadata: {
          period,
          startDate: startDate.toISOString().split("T")[0],
          endDate: now.toISOString().split("T")[0],
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Create lookup map for previous year metrics (by customer_id)
    const prevMetricsMap = new Map<number, { netRevenue: number }>();
    for (const prev of prevMetrics) {
      // Handle HH Print consolidation: both 2043 and 2149 map to 2043
      const customerId =
        prev.customer_id === 2149 ? 2043 : prev.customer_id;
      prevMetricsMap.set(customerId, {
        netRevenue: prev.net_revenue || 0,
      });
    }

    // Convert aggregated data to response format
    const customerResults = customerMetrics.map((customer: any) => {
      const customerId = customer.customer_id;
      const prev = prevMetricsMap.get(customerId);
      const prevRevenue = prev ? prev.netRevenue : 0;
      const current = customer.net_revenue || 0;

      const base = {
        customerId: String(customerId),
        customerName: fixEncoding(customer.customer_name) || "(Unknown)",
        city: fixEncoding(customer.city) || "",
        salesperson: fixEncoding(customer.salesperson?.trim()) || "(Unassigned)",
        invoiceCount: customer.invoice_count || 0,
        netRevenue: Math.round((customer.net_revenue || 0) * 100) / 100,
        cancelledRevenue: 0, // Not tracked in aggregated function
        firstInvoice: customer.first_invoice_date
          ? (typeof customer.first_invoice_date === "string"
              ? customer.first_invoice_date.split("T")[0]
              : new Date(customer.first_invoice_date).toISOString().split("T")[0])
          : "",
        lastInvoice: customer.last_invoice_date
          ? (typeof customer.last_invoice_date === "string"
              ? customer.last_invoice_date.split("T")[0]
              : new Date(customer.last_invoice_date).toISOString().split("T")[0])
          : "",
        daysSinceLastInvoice: customer.last_invoice_date
          ? Math.floor(
              (now.getTime() -
                (typeof customer.last_invoice_date === "string"
                  ? new Date(customer.last_invoice_date).getTime()
                  : new Date(customer.last_invoice_date).getTime())) /
                (1000 * 60 * 60 * 24),
            )
          : 0,
      };

      if (period === "ytd") {
        const previousNetRevenue = Math.round(prevRevenue * 100) / 100;
        const previousDeltaValue =
          Math.round((current - prevRevenue) * 100) / 100;
        const previousDeltaPct =
          prevRevenue !== 0
            ? Math.round(
                ((current - prevRevenue) / Math.abs(prevRevenue)) * 10000,
              ) / 100
            : null;

        return {
          ...base,
          previousNetRevenue,
          previousDeltaValue,
          previousDeltaPct,
        };
      }

      return base;
    });

    // Calculate total revenue for percentage calculations
    const totalRevenue = customerResults.reduce(
      (sum: number, customer: any) => sum + customer.netRevenue,
      0,
    );

    // Add revenue share percentage
    const customersWithShare = customerResults.map((customer: any) => {
      const revenueSharePct =
        totalRevenue > 0
          ? Math.round((customer.netRevenue / totalRevenue) * 10000) / 100
          : 0;
      return {
        ...customer,
        revenueSharePct,
      };
    });

    // Sort by revenue descending and apply limit
    const sortedCustomers = customersWithShare
      .sort((a: any, b: any) => b.netRevenue - a.netRevenue)
      .slice(0, limit)
      .map((customer: any, index: number) => ({
        rank: index + 1,
        ...customer,
      }));

    // Calculate summary statistics
    const summary = {
      totalCustomers: customerMetrics.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalInvoices: customerMetrics.reduce(
        (sum: number, c: any) => sum + (c.invoice_count || 0),
        0,
      ),
      topCustomersRevenue:
        Math.round(
          sortedCustomers.reduce((sum: number, c: any) => sum + c.netRevenue, 0) * 100,
        ) / 100,
      topCustomersSharePct:
        totalRevenue > 0
          ? Math.round(
              (sortedCustomers.reduce((sum: number, c: any) => sum + c.netRevenue, 0) /
                totalRevenue) *
                100 *
                100,
            ) / 100
          : 0,
    };

    const response = {
      customers: sortedCustomers,
      summary,
      metadata: {
        period,
        startDate: startDate.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        limit,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Top Customers Analysis Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top customers data" },
      { status: 500 },
    );
  }
}
