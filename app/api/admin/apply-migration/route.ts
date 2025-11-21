import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/apply-migration
 *
 * Applies the pipeline optimization migration directly
 * This bypasses migration version conflicts
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    console.log("🚀 Reading migration file...");
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20251121000002_optimize_pipeline_performance.sql"
    );

    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("📝 Applying migration...");

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    const results = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt) {
        console.log(`[${i + 1}/${statements.length}] Executing statement...`);

        const { data, error } = await supabase.rpc("exec_sql", {
          sql: stmt + ";",
        });

        if (error) {
          console.error(`❌ Statement ${i + 1} failed:`, error);
          results.push({ statement: i + 1, success: false, error: error.message });
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
          results.push({ statement: i + 1, success: true });
        }
      }
    }

    // Test the optimized functions
    console.log("\n📊 Testing optimized functions...");

    const { data: testData, error: testError } = await supabase.rpc(
      "get_department_pipeline_top15",
      {
        departamento_nome: "IMACX",
        start_date: "2025-01-01",
        end_date: "2025-11-21",
      }
    );

    if (testError) {
      console.error("❌ Test failed:", testError);
      return NextResponse.json(
        {
          success: false,
          message: "Migration applied but test failed",
          results,
          testError: testError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Test passed! Returned ${testData?.length || 0} quotes`);

    return NextResponse.json({
      success: true,
      message: "Migration applied successfully",
      results,
      test: {
        quotesReturned: testData?.length || 0,
      },
    });
  } catch (error) {
    console.error("❌ Error applying migration:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
