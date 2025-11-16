import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Step 1: Authenticate with server client (has cookie access)
    const cookieStore = cookies();
    const authClient = await createServerClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 2: Query with admin client (bypasses RLS)
    const supabase = createAdminClient();

    // Get current date and year
    const now = new Date();
    const currentYear = now.getFullYear();
    const ytdEndDate = now.toISOString().split("T")[0]; // Current date in YYYY-MM-DD

    // Call the RPC function to get salesperson performance
    const { data, error: dbError } = await supabase.rpc(
      "get_salesperson_performance_ytd",
      {
        current_year: currentYear,
        ytd_end_date: ytdEndDate,
      },
    );

    if (dbError) {
      console.error("Database error in salesperson-performance:", dbError);
      return NextResponse.json(
        {
          error: "Failed to fetch salesperson performance data",
          details: dbError.message,
        },
        { status: 500 },
      );
    }

    // Format the response - group by salesperson name to eliminate duplicates
    // Also consolidate "SEM DEPARTAMENTO" to "IMACX"
    const groupedData = (data || []).reduce((acc: any[], person: any) => {
      const personName = person.salesperson_name || "IMACX";
      const deptName = person.department_name || "IMACX";

      // Find existing person by name only (ignore department differences)
      const existingPerson = acc.find((p) => p.name === personName);

      if (existingPerson) {
        // Aggregate values for duplicate salesperson
        existingPerson.sales_ytd += Number(person.sales_ytd || 0);
        existingPerson.quotes_ytd += Number(person.quotes_ytd || 0);
        existingPerson.invoices_ytd += Number(person.invoices_ytd || 0);
        existingPerson.customers_ytd += Number(person.customers_ytd || 0);
        existingPerson.sales_ytd_prev += Number(person.sales_ytd_prev || 0);
        existingPerson.quotes_ytd_prev += Number(person.quotes_ytd_prev || 0);
        existingPerson.invoices_ytd_prev += Number(
          person.invoices_ytd_prev || 0,
        );
        existingPerson.customers_ytd_prev += Number(
          person.customers_ytd_prev || 0,
        );

        // Prefer non-IMACX department if available
        if (existingPerson.department === "IMACX" && deptName !== "IMACX") {
          existingPerson.department = deptName;
        }

        // Recalculate avg_ticket_ytd
        if (existingPerson.invoices_ytd > 0) {
          existingPerson.avg_ticket_ytd =
            existingPerson.sales_ytd / existingPerson.invoices_ytd;
        }

        // Recalculate YoY percentages
        if (existingPerson.sales_ytd_prev > 0) {
          existingPerson.sales_yoy_change_pct =
            ((existingPerson.sales_ytd - existingPerson.sales_ytd_prev) /
              existingPerson.sales_ytd_prev) *
            100;
        }
        if (existingPerson.quotes_ytd_prev > 0) {
          existingPerson.quotes_yoy_change_pct =
            ((existingPerson.quotes_ytd - existingPerson.quotes_ytd_prev) /
              existingPerson.quotes_ytd_prev) *
            100;
        }
      } else {
        // Add new salesperson
        acc.push({
          name: personName,
          department: deptName,
          // Current Year YTD
          sales_ytd: Number(person.sales_ytd || 0),
          quotes_ytd: Number(person.quotes_ytd || 0),
          invoices_ytd: Number(person.invoices_ytd || 0),
          customers_ytd: Number(person.customers_ytd || 0),
          avg_ticket_ytd: Number(person.avg_ticket_ytd || 0),
          // Previous Year YTD
          sales_ytd_prev: Number(person.sales_ytd_prev || 0),
          quotes_ytd_prev: Number(person.quotes_ytd_prev || 0),
          invoices_ytd_prev: Number(person.invoices_ytd_prev || 0),
          customers_ytd_prev: Number(person.customers_ytd_prev || 0),
          // YoY Changes
          sales_yoy_change_pct:
            person.sales_yoy_change_pct !== null
              ? Number(person.sales_yoy_change_pct)
              : null,
          quotes_yoy_change_pct:
            person.quotes_yoy_change_pct !== null
              ? Number(person.quotes_yoy_change_pct)
              : null,
        });
      }

      return acc;
    }, []);

    const formattedData = {
      salespeople: groupedData,
      metadata: {
        generatedAt: new Date().toISOString(),
        currentYear,
        ytdEndDate,
        totalSalespeople: groupedData.length,
      },
    };

    // Calculate summary totals
    const summary: any = {
      total_sales_ytd: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.sales_ytd,
        0,
      ),
      total_quotes_ytd: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.quotes_ytd,
        0,
      ),
      total_invoices_ytd: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.invoices_ytd,
        0,
      ),
      total_customers_ytd: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.customers_ytd,
        0,
      ),
      total_sales_ytd_prev: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.sales_ytd_prev,
        0,
      ),
      total_quotes_ytd_prev: formattedData.salespeople.reduce(
        (sum: number, p: any) => sum + p.quotes_ytd_prev,
        0,
      ),
    };

    // Add YoY changes to summary
    summary["sales_yoy_change_pct"] =
      summary.total_sales_ytd_prev > 0
        ? ((summary.total_sales_ytd - summary.total_sales_ytd_prev) /
            summary.total_sales_ytd_prev) *
          100
        : null;
    summary["quotes_yoy_change_pct"] =
      summary.total_quotes_ytd_prev > 0
        ? ((summary.total_quotes_ytd - summary.total_quotes_ytd_prev) /
            summary.total_quotes_ytd_prev) *
          100
        : null;

    return NextResponse.json({
      ...formattedData,
      summary,
    });
  } catch (error) {
    console.error("Error in salesperson-performance route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
