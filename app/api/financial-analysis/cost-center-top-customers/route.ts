import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type {
  CostCenterTopCustomer,
  CostCenterTopCustomersResponse,
} from "@/types/financial-analysis";
import { fixEncoding } from "@/utils/encodingHelpers";

const COST_CENTERS = [
  "ID-Impressão Digital",
  "BR-Brindes",
  "IO-Impressão OFFSET",
] as const;

const clampLimit = (value: number, min = 1, max = 50) =>
  Math.max(min, Math.min(max, value));

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const authClient = await createServerClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "ytd").toLowerCase();

    // Validate period
    if (!["ytd", "mtd"].includes(period)) {
      return NextResponse.json(
        { error: "Period must be 'ytd' or 'mtd'" },
        { status: 400 },
      );
    }

    const limitParam = searchParams.get("limit");
    const limit = clampLimit(
      limitParam && !Number.isNaN(Number(limitParam))
        ? parseInt(limitParam, 10)
        : 20,
    );

    const supabase = createAdminClient();
    const now = new Date();

    // Calculate date range based on period (for metadata)
    let startDate: Date;
    if (period === "mtd") {
      // Month-to-Date: First day of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // Year-to-Date: January 1st
      startDate = new Date(now.getFullYear(), 0, 1);
    }
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = now.toISOString().split("T")[0];

    // Call the RPC function with period parameter
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_cost_center_top_customers",
      { p_period: period, p_limit: limit },
    );

    if (rpcError) {
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    if (!rpcData) {
      throw new Error("No data returned from RPC");
    }

    // Group results by cost center
    const costCenterMap = new Map<
      string,
      Array<{
        rank: number;
        customer_id: number;
        customer_name: string;
        city: string;
        salesperson: string;
        invoice_count: number;
        net_revenue: number;
        revenue_share_pct: number;
        last_invoice: string;
        days_since_last_invoice: number;
      }>
    >();

    rpcData.forEach((row: any) => {
      const costCenter = row.centro_custo; // Database returns 'centro_custo'
      if (!costCenterMap.has(costCenter)) {
        costCenterMap.set(costCenter, []);
      }
      costCenterMap.get(costCenter)!.push({
        rank: Number(row.rank),
        customer_id: Number(row.customer_id),
        customer_name: fixEncoding(row.customer_name) || "(Sem Nome)",
        city: fixEncoding(row.city) || "",
        salesperson: fixEncoding(row.salesperson) || "(Sem Vendedor)",
        invoice_count: Number(row.invoice_count),
        net_revenue: Number(row.net_revenue),
        revenue_share_pct: Number(row.revenue_share_pct),
        last_invoice: row.last_invoice,
        days_since_last_invoice: Number(row.days_since_last_invoice),
      });
    });

    // Build response structure
    const response: CostCenterTopCustomersResponse = {
      costCenters: COST_CENTERS.map((center) => {
        const customers = costCenterMap.get(center) || [];
        const totalRevenue = customers.reduce(
          (sum, c) => sum + c.net_revenue,
          0,
        );
        const totalInvoices = customers.reduce(
          (sum, c) => sum + c.invoice_count,
          0,
        );

        return {
          costCenter: center,
          customers: customers.map((c) => ({
            rank: c.rank,
            customerId: String(c.customer_id),
            customerName: c.customer_name,
            city: c.city,
            salesperson: c.salesperson,
            invoiceCount: c.invoice_count,
            quoteCount: 0, // TODO: Implement later
            conversionRate: null, // TODO: Implement later
            netRevenue: Math.round(c.net_revenue * 100) / 100,
            revenueSharePct: Math.round(c.revenue_share_pct * 100) / 100,
            lastInvoice: c.last_invoice,
            daysSinceLastInvoice: c.days_since_last_invoice,
          })),
          summary: {
            totalCustomers: customers.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalInvoices,
          },
        };
      }),
      metadata: {
        period: period as "ytd" | "mtd",
        startDate: startStr,
        endDate: endStr,
        limit,
        generatedAt: now.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Cost center top customers API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
