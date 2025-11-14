import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Call the RPC function to get department performance
    const { data, error: dbError } = await supabase.rpc(
      "get_department_performance_ytd",
      {
        current_year: currentYear,
        ytd_end_date: ytdEndDate,
      },
    );

    if (dbError) {
      console.error("Database error in department-performance:", dbError);
      return NextResponse.json(
        {
          error: "Failed to fetch department performance data",
          details: dbError.message,
        },
        { status: 500 },
      );
    }

    // Format the response
    const formattedData = {
      departments: (data || []).map((dept: any) => ({
        department: dept.department_name || "IMACX",
        // Current Year
        sales_ytd: Number(dept.sales_ytd || 0),
        quotes_ytd: Number(dept.quotes_ytd || 0),
        invoices_ytd: Number(dept.invoices_ytd || 0),
        customers_ytd: Number(dept.customers_ytd || 0),
        // Previous Year
        sales_ytd_prev: Number(dept.sales_ytd_prev || 0),
        quotes_ytd_prev: Number(dept.quotes_ytd_prev || 0),
        invoices_ytd_prev: Number(dept.invoices_ytd_prev || 0),
        customers_ytd_prev: Number(dept.customers_ytd_prev || 0),
        // Two Years Ago
        sales_ytd_2y: Number(dept.sales_ytd_2y || 0),
        quotes_ytd_2y: Number(dept.quotes_ytd_2y || 0),
        // YoY Changes
        sales_yoy_change_pct:
          dept.sales_yoy_change_pct !== null
            ? Number(dept.sales_yoy_change_pct)
            : null,
        quotes_yoy_change_pct:
          dept.quotes_yoy_change_pct !== null
            ? Number(dept.quotes_yoy_change_pct)
            : null,
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        currentYear,
        ytdEndDate,
        totalDepartments: data?.length || 0,
      },
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error in department-performance route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
