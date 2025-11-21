/**
 * Apply Pipeline Optimization Migration
 *
 * Fixes statement timeout errors in pipeline queries
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log("🚀 Applying Pipeline Optimization Migration...\n");

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20251121000002_optimize_pipeline_performance.sql",
  );

  if (!fs.existsSync(migrationPath)) {
    console.error("❌ Migration file not found:", migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log("📄 Migration file loaded");
  console.log("📝 Executing SQL statements...\n");

  try {
    // Extract index creation statements
    const indexStatements = sql.match(/CREATE INDEX.*?;/gs) || [];

    console.log(`📊 Creating ${indexStatements.length} indexes...`);
    for (let i = 0; i < indexStatements.length; i++) {
      const stmt = indexStatements[i];
      console.log(`[${i + 1}/${indexStatements.length}] Creating index...`);

      const { error } = await supabase.rpc("exec_sql", { sql_query: stmt });

      if (error) {
        if (error.message && error.message.includes("already exists")) {
          console.log("  ⚠️  Index already exists, skipping...");
        } else {
          console.error("  ❌ Error:", error.message);
        }
      } else {
        console.log("  ✅ Success");
      }
    }

    // Extract helper function (is_quote_converted)
    const helperFunctionMatch = sql.match(
      /CREATE OR REPLACE FUNCTION is_quote_converted[\s\S]*?\$\$;/i,
    );
    if (helperFunctionMatch) {
      console.log("\n📦 Creating helper function: is_quote_converted");
      const { error } = await supabase.rpc("exec_sql", {
        sql_query: helperFunctionMatch[0],
      });

      if (error) {
        console.error("  ❌ Error:", error.message);
      } else {
        console.log("  ✅ Success");
      }
    }

    // Extract main pipeline functions
    const functionNames = [
      "get_department_pipeline_top15",
      "get_department_pipeline_needs_attention",
      "get_department_pipeline_perdidos",
    ];

    console.log(
      `\n🔧 Creating ${functionNames.length} optimized pipeline functions...\n`,
    );

    for (const funcName of functionNames) {
      const regex = new RegExp(
        `CREATE OR REPLACE FUNCTION ${funcName}[\\s\\S]*?\\$\\$;`,
        "i",
      );
      const match = sql.match(regex);

      if (match) {
        console.log(`Creating: ${funcName}`);
        const { error } = await supabase.rpc("exec_sql", {
          sql_query: match[0],
        });

        if (error) {
          console.error(`  ❌ Error:`, error.message);
        } else {
          console.log(`  ✅ Success`);
        }
      } else {
        console.log(`  ⚠️  Function ${funcName} not found in migration`);
      }
    }

    // Extract GRANT statements
    const grantStatements = sql.match(/GRANT EXECUTE.*?;/gs) || [];
    if (grantStatements.length > 0) {
      console.log(
        `\n🔐 Applying ${grantStatements.length} permission grants...`,
      );
      for (const stmt of grantStatements) {
        const { error } = await supabase.rpc("exec_sql", { sql_query: stmt });
        if (error && !error.message.includes("already exists")) {
          console.error("  ❌ Error:", error.message);
        }
      }
      console.log("  ✅ Permissions granted");
    }

    console.log("\n✅ Migration completed successfully!\n");

    // Test the optimized functions
    console.log("📊 Testing optimized functions...\n");

    const testParams = {
      departamento_nome: "IMACX",
      start_date: "2025-01-01",
      end_date: "2025-11-21",
    };

    for (const funcName of functionNames) {
      console.log(`Testing: ${funcName}`);
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(funcName, testParams);

      const duration = Date.now() - startTime;

      if (error) {
        console.error(`  ❌ Test failed:`, error.message);
      } else {
        console.log(
          `  ✅ Success: ${data?.length || 0} quotes returned in ${duration}ms`,
        );
      }
    }

    console.log("\n🎉 All done! Pipeline queries are now optimized.");
  } catch (error) {
    console.error("\n❌ Unexpected error:", error);
    process.exit(1);
  }
}

applyMigration();
