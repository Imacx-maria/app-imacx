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

    // Use RPC function to fetch invoices (bypasses RLS permission issues)
    const { data: invoices, error: invoicesError } = await supabase.rpc(
      "get_invoices_for_period",
      {
        start_date: startStr,
        end_date: endStr,
        use_historical: false,
      },
    );

    if (invoicesError) {
      console.error(`❌ [Top Customers] Query error on ft:`, invoicesError);
      throw invoicesError;
    }

    // Previous-year YTD window (for YTD only) from phc.2years_ft
    let prevRows: any[] = [];
    if (period === "ytd") {
      const prevStart = new Date(startDate);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(now);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const prevStartStr = prevStart.toISOString().split("T")[0];
      const prevEndStr = prevEnd.toISOString().split("T")[0];

      const { data: prevData, error: prevError } = await supabase.rpc(
        "get_invoices_for_period",
        {
          start_date: prevStartStr,
          end_date: prevEndStr,
          use_historical: true,
        },
      );

      if (prevError) {
        console.error(
          `❌ [Top Customers] Query error on 2years_ft:`,
          prevError,
        );
        throw prevError;
      }

      prevRows = prevData || [];
    }

    console.log(
      `✅ [Top Customers] Current rows=${invoices.length}, Prev rows=${prevRows.length}`,
    );

    // Helper to filter valid documents (Factura + Nota de Crédito, not cancelled)
    const filterValid = (rows: any[]) =>
      (rows || []).filter((inv) => {
        const isNotCancelled =
          !inv.anulado || inv.anulado === false || inv.anulado === "False";
        const isValidType =
          inv.document_type === "Factura" ||
          inv.document_type === "Nota de Crédito";
        return isNotCancelled && isValidType;
      });

    const validInvoices = filterValid(invoices);
    const validPrevInvoices = filterValid(prevRows || []);

    console.log(
      `✅ [Top Customers] Current valid: ${validInvoices.length}, Prev valid: ${validPrevInvoices.length}`,
    );

    // Get unique customer IDs from current-period invoices ONLY.
    // IMPORTANT:
    // - We intentionally DO NOT include validPrevInvoices here.
    // - This ensures previous-year metrics are computed ONLY for customers
    //   that exist in the current-period Top table (apples-to-apples YTD),
    //   matching the SQL you just ran for HH PRINT (current ids only).
    const customerIds = [
      ...new Set(validInvoices.map((inv) => inv.customer_id)),
    ];

    if (customerIds.length === 0) {
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

    // Fetch customer details using RPC (bypasses RLS)
    const { data: customers, error: customersError } = await supabase.rpc(
      "get_customers_by_ids",
      {
        customer_ids: customerIds,
      },
    );

    if (customersError) {
      console.error("Customers Error:", customersError);
      return NextResponse.json(
        { error: customersError.message },
        { status: 500 },
      );
    }

    // Create customer lookup map
    const customerMap = new Map<
      string | number,
      {
        rawId: string | number;
        name: string;
        city: string;
        salesperson: string;
      }
    >(
      customers?.map((c: any) => [
        c.customer_id,
        {
          rawId: c.customer_id,
          name: fixEncoding(c.customer_name) || "(Unknown)",
          city: fixEncoding(c.city) || "",
          salesperson: fixEncoding(c.salesperson?.trim()) || "(Unassigned)",
        },
      ]) || [],
    );

    // Group invoices by customer (with special HH Print consolidation rule)
    const customerMetrics = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        city: string;
        salesperson: string;
        invoiceCount: number;
        netRevenue: number;
        cancelledRevenue: number;
        firstInvoice: Date;
        lastInvoice: Date;
      }
    >();

    // Helper to normalize key for special grouped customers
    const getCustomerKey = (info: {
      rawId: number | string;
      name: string;
    }): string => {
      const idNum =
        typeof info.rawId === "string" ? parseInt(info.rawId, 10) : info.rawId;

      // Business rule (explicit, deterministic):
      // - Group ONLY customer_id 2043 and 2149 together
      // - Do NOT include any other ids, even if their names match
      if (idNum === 2043 || idNum === 2149) {
        return "HH_PRINT_MANAGEMENT_GROUP";
      }

      // Default: each raw id is its own key
      return String(info.rawId);
    };
    for (const invoice of validInvoices) {
      const originalCustomerId = invoice.customer_id;
      const customerInfo = customerMap.get(originalCustomerId);
      if (!customerInfo) continue;
      if (!customerInfo.rawId || !customerInfo.name) continue;

      // Apply consolidation rule (e.g., HH PRINT MANAGEMENT group)
      const customerKey = getCustomerKey(customerInfo);

      if (!customerMetrics.has(customerKey)) {
        customerMetrics.set(customerKey, {
          customerId: customerKey,
          customerName:
            customerKey === "HH_PRINT_MANAGEMENT_GROUP"
              ? "HH PRINT MANAGEMENT [AGRUPADO]"
              : customerInfo.name,
          city: customerInfo.city,
          salesperson: customerInfo.salesperson,
          invoiceCount: 0,
          netRevenue: 0,
          cancelledRevenue: 0,
          firstInvoice: new Date(invoice.invoice_date),
          lastInvoice: new Date(invoice.invoice_date),
        });
      }

      const metrics = customerMetrics.get(customerKey)!;
      const value = invoice.net_value || 0;
      const invoiceDate = new Date(invoice.invoice_date);

      // Update first and last invoice dates
      if (invoiceDate < metrics.firstInvoice) {
        metrics.firstInvoice = invoiceDate;
      }
      if (invoiceDate > metrics.lastInvoice) {
        metrics.lastInvoice = invoiceDate;
      }

      // Revenue calculation:
      // - Facturas: add net_value (positive)
      // - Notas de Crédito: add net_value (already negative in DB)
      // Cancelled invoices already filtered out by filterValid
      const isFactura = invoice.document_type === "Factura";
      const isNotaCredito = invoice.document_type === "Nota de Crédito";

      if (isFactura) {
        metrics.netRevenue += value;
        metrics.invoiceCount++;
      } else if (isNotaCredito) {
        metrics.netRevenue += value; // add negative value -> subtracts correctly
      }
    }

    // Optionally compute previous-year revenue per customer for YTD comparison
    const prevMetrics = new Map<
      string,
      {
        netRevenue: number;
      }
    >();

    if (period === "ytd" && validPrevInvoices.length > 0) {
      for (const inv of validPrevInvoices) {
        const originalCustomerId = inv.customer_id;

        // Try to map using current customer map (preferred for consistency)
        const mapInfo = customerMap.get(originalCustomerId);

        // If not found (historical-only id), derive minimal info from invoice
        const fallbackName =
          (inv as any).customer_name &&
          typeof (inv as any).customer_name === "string"
            ? fixEncoding((inv as any).customer_name)
            : "";

        const info: { rawId: number | string; name: string } = mapInfo
          ? { rawId: mapInfo.rawId, name: mapInfo.name }
          : {
              rawId: originalCustomerId,
              name: fallbackName || String(originalCustomerId),
            };

        const customerKey = getCustomerKey(info);
        const isFactura = inv.document_type === "Factura";
        const isNotaCredito = inv.document_type === "Nota de Crédito";
        const value = inv.net_value || 0;

        if (!isFactura && !isNotaCredito) continue;

        const existing = prevMetrics.get(customerKey) || { netRevenue: 0 };
        existing.netRevenue += value; // Facturas positive, NC negative
        prevMetrics.set(customerKey, existing);
      }
    }

    // Calculate total revenue for percentage calculations (current period only)
    const totalRevenue = Array.from(customerMetrics.values()).reduce(
      (sum, customer) => sum + customer.netRevenue,
      0,
    );

    // Convert to array, calculate additional metrics, and sort by revenue
    const customerResults = Array.from(customerMetrics.values())
      .filter((customer) => customer.netRevenue > 0)
      .map((customer) => {
        const base = {
          customerId: customer.customerId,
          customerName: customer.customerName,
          city: customer.city,
          salesperson: customer.salesperson,
          invoiceCount: customer.invoiceCount,
          netRevenue: Math.round(customer.netRevenue * 100) / 100,
          cancelledRevenue: Math.round(customer.cancelledRevenue * 100) / 100,
          firstInvoice: customer.firstInvoice.toISOString().split("T")[0],
          lastInvoice: customer.lastInvoice.toISOString().split("T")[0],
          daysSinceLastInvoice: Math.floor(
            (now.getTime() - customer.lastInvoice.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        };

        const revenueSharePct =
          totalRevenue > 0
            ? Math.round((customer.netRevenue / totalRevenue) * 10000) / 100
            : 0;

        if (period === "ytd") {
          const prev = prevMetrics.get(customer.customerId);
          const prevRevenue = prev ? prev.netRevenue : 0;
          const current = customer.netRevenue;

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
            revenueSharePct,
            previousNetRevenue,
            previousDeltaValue,
            previousDeltaPct,
          };
        }

        // Non-YTD periods: keep existing shape
        return {
          ...base,
          revenueSharePct,
        };
      })
      .sort((a, b) => b.netRevenue - a.netRevenue)
      .slice(0, limit)
      .map((customer, index) => ({
        rank: index + 1,
        ...customer,
      }));

    // Calculate summary statistics
    const summary = {
      totalCustomers: customerMetrics.size,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalInvoices: Array.from(customerMetrics.values()).reduce(
        (sum, c) => sum + c.invoiceCount,
        0,
      ),
      topCustomersRevenue:
        Math.round(
          customerResults.reduce((sum, c) => sum + c.netRevenue, 0) * 100,
        ) / 100,
      topCustomersSharePct:
        totalRevenue > 0
          ? Math.round(
              (customerResults.reduce((sum, c) => sum + c.netRevenue, 0) /
                totalRevenue) *
                100 *
                100,
            ) / 100
          : 0,
    };

    const response = {
      customers: customerResults,
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
