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

    // Step 2: Get query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "ytd"; // Default to YTD

    // Step 3: Query with admin client (bypasses RLS)
    const supabase = createAdminClient();

    // Get current date information
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = now.getDate();

    // Call the appropriate RPC function based on period
    const rpcFunction =
      period === "mtd"
        ? "get_cost_center_multi_year_mtd"
        : "get_cost_center_multi_year_ytd";

    const { data, error: dbError } = await supabase.rpc(rpcFunction, {
      current_year: currentYear,
      current_month: currentMonth,
      current_day: currentDay,
    });

    if (dbError) {
      console.error("Database error in cost-center-performance:", dbError);
      return NextResponse.json(
        {
          error: "Failed to fetch cost center performance data",
          details: dbError.message,
        },
        { status: 500 },
      );
    }

    // Format the response
    const formattedData = {
      costCenters: (data || []).map((cc: any) => ({
        costCenter: cc.cost_center,
        currentYear: Number(cc.ano_atual || 0),
        previousYear: Number(cc.ano_anterior || 0),
        twoYearsAgo: Number(cc.ano_anterior_2 || 0),
        // Calculate YoY change percentage
        yoyChangePct:
          cc.ano_anterior > 0
            ? Number(
                (
                  ((cc.ano_atual - cc.ano_anterior) / cc.ano_anterior) *
                  100
                ).toFixed(1),
              )
            : null,
        // Calculate 2-year change percentage
        twoYearChangePct:
          cc.ano_anterior_2 > 0
            ? Number(
                (
                  ((cc.ano_atual - cc.ano_anterior_2) / cc.ano_anterior_2) *
                  100
                ).toFixed(1),
              )
            : null,
      })),
      years: [currentYear, currentYear - 1, currentYear - 2],
      metadata: {
        generatedAt: new Date().toISOString(),
        currentYear,
        currentMonth,
        currentDay,
        period: period, // "mtd" or "ytd"
        periodLabel:
          period === "mtd"
            ? `${now.toLocaleDateString("pt-PT", { month: "long" })} ${currentYear}`
            : `Jan - ${now.toLocaleDateString("pt-PT", { month: "short", day: "numeric" })}`,
        ytdEndDate: now.toISOString().split("T")[0],
        totalCostCenters: data?.length || 0,
      },
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error in cost-center-performance route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
