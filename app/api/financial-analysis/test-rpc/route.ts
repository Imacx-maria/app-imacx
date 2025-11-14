import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * TEST ENDPOINT: /api/financial-analysis/test-rpc
 *
 * Tests if the calculate_ytd_kpis RPC function works correctly
 */
export async function GET(request: Request) {
  // Validate authentication
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
    console.log("\n========================================");
    console.log("🧪 TESTING RPC FUNCTION");
    console.log("========================================");

    // Test 1: Call RPC for current year (ft table)
    console.log("\n📊 Test 1: Current year (ft table)");
    const { data: currentYearData, error: currentYearError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: "2025-01-01",
        end_date: "2025-11-13",
        source_table: "ft",
      }
    );

    if (currentYearError) {
      console.error("❌ Current year RPC error:", currentYearError);
      return NextResponse.json(
        {
          success: false,
          test: "current_year",
          error: currentYearError,
          message: "RPC function failed for current year",
          hint: "Check if RPC function exists and has correct parameters",
        },
        { status: 500 }
      );
    }

    console.log("✅ Current year RPC success:", currentYearData);

    // Test 2: Call RPC for historical year (2years_ft table)
    console.log("\n📊 Test 2: Historical year (2years_ft table)");
    const { data: historicalData, error: historicalError } = await supabase.rpc(
      "calculate_ytd_kpis",
      {
        start_date: "2024-01-01",
        end_date: "2024-11-13",
        source_table: "2years_ft",
      }
    );

    if (historicalError) {
      console.error("❌ Historical RPC error:", historicalError);
      return NextResponse.json(
        {
          success: false,
          test: "historical_year",
          error: historicalError,
          message: "RPC function failed for historical year",
          hint: "Check if 2years_ft table exists in phc schema",
        },
        { status: 500 }
      );
    }

    console.log("✅ Historical RPC success:", historicalData);

    console.log("\n========================================");
    console.log("✅ ALL TESTS PASSED");
    console.log("========================================\n");

    // Return success with data
    return NextResponse.json({
      success: true,
      message: "RPC function is working correctly",
      tests: {
        currentYear: {
          passed: true,
          data: currentYearData,
          params: {
            start_date: "2025-01-01",
            end_date: "2025-11-13",
            source_table: "ft",
          },
        },
        historicalYear: {
          passed: true,
          data: historicalData,
          params: {
            start_date: "2024-01-01",
            end_date: "2024-11-13",
            source_table: "2years_ft",
          },
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: "Unexpected error during RPC test",
      },
      { status: 500 }
    );
  }
}
