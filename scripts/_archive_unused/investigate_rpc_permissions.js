const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://bnfixjkjrbfalgcqhzof.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZml4amtqcmJmYWxnY3Foem9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0NzMxNiwiZXhwIjoyMDYwMjIzMzE2fQ.tlB_snZsX5mY3g453yyx3DFVrVSa7xxU6JUx_yzIoBc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateDatabase() {
  console.log("=".repeat(80));
  console.log("SUPABASE DATABASE RPC PERMISSIONS INVESTIGATION");
  console.log("=".repeat(80));
  console.log();

  // 1. Find all functions starting with "get_department_" in public schema
  console.log('1. FUNCTIONS STARTING WITH "get_department_"');
  console.log("-".repeat(80));

  const { data: functions, error: funcError } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT
        p.proname as function_name,
        pg_catalog.pg_get_function_arguments(p.oid) as arguments,
        pg_catalog.pg_get_function_result(p.oid) as return_type,
        CASE
          WHEN p.prosecdef THEN 'SECURITY DEFINER'
          ELSE 'SECURITY INVOKER'
        END as security_type,
        p.oid::regprocedure::text as full_signature
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname LIKE 'get_department_%'
      ORDER BY p.proname;
    `,
  });

  // Try direct SQL query instead
  const { data: functionsData, error: funcError2 } = await supabase
    .from("pg_catalog.pg_proc")
    .select("*")
    .ilike("proname", "get_department_%");

  // Let's try a raw SQL approach using pg_catalog
  const functionsQuery = `
    SELECT
      p.proname as function_name,
      pg_catalog.pg_get_function_arguments(p.oid) as arguments,
      pg_catalog.pg_get_function_result(p.oid) as return_type,
      CASE
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
      END as security_type,
      p.oid::regprocedure::text as full_signature,
      obj_description(p.oid, 'pg_proc') as description
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'get_department_%'
    ORDER BY p.proname;
  `;

  // Skip direct catalog query for now, check functions individually

  // List of expected functions from migration files
  const expectedFunctions = [
    "get_department_rankings",
    "get_department_conversion_rates_by_month",
    "get_department_conversion_rates",
  ];

  console.log("\nChecking existence of expected functions:");
  for (const funcName of expectedFunctions) {
    try {
      // Try to call with dummy params to see if function exists
      const { data, error } = await supabase.rpc(funcName, {
        target_year: 2025,
        target_month: 1,
      });

      if (error) {
        if (error.message.includes("Could not find the function")) {
          console.log(`❌ ${funcName} - DOES NOT EXIST`);
        } else {
          console.log(
            `✓ ${funcName} - EXISTS (error was: ${error.message.substring(0, 100)}...)`,
          );
        }
      } else {
        console.log(`✓ ${funcName} - EXISTS and callable`);
      }
    } catch (e) {
      console.log(`❌ ${funcName} - ERROR: ${e.message}`);
    }
  }

  console.log();
  console.log("2. PERMISSIONS ON PHC SCHEMA TABLES");
  console.log("-".repeat(80));

  // Check table permissions via information_schema
  const tables = ["bo", "ft", "bi", "cl", "fi"];

  console.log("\nChecking if authenticated role can access PHC tables:");
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .schema("phc")
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(
          `❌ phc.${table} - NO ACCESS (${error.message.substring(0, 80)})`,
        );
      } else {
        console.log(`✓ phc.${table} - ACCESSIBLE (${count} rows)`);
      }
    } catch (e) {
      console.log(`❌ phc.${table} - ERROR: ${e.message.substring(0, 80)}`);
    }
  }

  console.log();
  console.log("3. CHECKING HISTORICAL TABLES (2years_*)");
  console.log("-".repeat(80));

  const historicalTables = ["2years_bo", "2years_ft", "2years_fi"];

  for (const table of historicalTables) {
    try {
      const { data, error, count } = await supabase
        .schema("phc")
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(
          `❌ phc.${table} - NO ACCESS (${error.message.substring(0, 80)})`,
        );
      } else {
        console.log(`✓ phc.${table} - ACCESSIBLE (${count} rows)`);
      }
    } catch (e) {
      console.log(`❌ phc.${table} - ERROR: ${e.message.substring(0, 80)}`);
    }
  }

  console.log();
  console.log("4. CHECKING PUBLIC SCHEMA TABLES");
  console.log("-".repeat(80));

  const publicTables = ["roles", "profiles", "permissions"];

  for (const table of publicTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(
          `❌ public.${table} - NO ACCESS (${error.message.substring(0, 80)})`,
        );
      } else {
        console.log(`✓ public.${table} - ACCESSIBLE (${count} rows)`);
      }
    } catch (e) {
      console.log(`❌ public.${table} - ERROR: ${e.message.substring(0, 80)}`);
    }
  }

  console.log();
  console.log("5. ATTEMPTING TO QUERY SYSTEM CATALOGS FOR PERMISSIONS");
  console.log("-".repeat(80));

  // Try to get permissions information
  try {
    const { data, error } = await supabase.rpc("get_department_rankings", {
      target_year: 2025,
      target_month: 11,
    });

    if (error) {
      console.log(`\n❌ get_department_rankings test call failed:`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Hint: ${error.hint || "N/A"}`);
      console.log(`   Details: ${error.details || "N/A"}`);
    } else {
      console.log(`\n✓ get_department_rankings test call succeeded`);
      console.log(`   Returned ${data ? data.length : 0} rows`);
      if (data && data.length > 0) {
        console.log(`   Sample row:`, JSON.stringify(data[0], null, 2));
      }
    }
  } catch (e) {
    console.log(`\n❌ get_department_rankings error: ${e.message}`);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("INVESTIGATION COMPLETE");
  console.log("=".repeat(80));
}

investigateDatabase().catch(console.error);
