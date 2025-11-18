const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables!");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "Set" : "Missing");
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "Set" : "Missing",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFunctions() {
  console.log("Testing Department Analysis Functions...\n");

  const today = new Date();
  const startDate = new Date(today.getFullYear(), 0, 1)
    .toISOString()
    .split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  console.log(`Date Range: ${startDate} to ${endDate}\n`);

  // Test 1: Escalões de Orçamentos
  console.log("1. Testing get_department_escaloes_orcamentos...");
  const { data: orcData, error: orcError } = await supabase.rpc(
    "get_department_escaloes_orcamentos",
    {
      departamento_nome: "Brindes",
      start_date: startDate,
      end_date: endDate,
    },
  );

  if (orcError) {
    console.error("❌ Error:", orcError);
  } else {
    console.log("✅ Success! Rows:", orcData?.length || 0);
    if (orcData && orcData.length > 0) {
      console.log("Sample:", orcData[0]);
    }
  }

  console.log("\n2. Testing get_department_escaloes_faturas...");
  const { data: fatData, error: fatError } = await supabase.rpc(
    "get_department_escaloes_faturas",
    {
      departamento_nome: "Brindes",
      start_date: startDate,
      end_date: endDate,
    },
  );

  if (fatError) {
    console.error("❌ Error:", fatError);
  } else {
    console.log("✅ Success! Rows:", fatData?.length || 0);
    if (fatData && fatData.length > 0) {
      console.log("Sample:", fatData[0]);
    }
  }

  console.log("\n3. Testing get_department_conversion_rates...");
  const { data: convData, error: convError } = await supabase.rpc(
    "get_department_conversion_rates",
    {
      departamento_nome: "Brindes",
      start_date: startDate,
      end_date: endDate,
    },
  );

  if (convError) {
    console.error("❌ Error:", convError);
  } else {
    console.log("✅ Success! Rows:", convData?.length || 0);
    if (convData && convData.length > 0) {
      console.log("Sample:", convData[0]);
    }
  }

  console.log("\n4. Testing get_department_customer_metrics...");
  const lytdStart = new Date(today.getFullYear() - 1, 0, 1)
    .toISOString()
    .split("T")[0];
  const lytdEnd = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate(),
  )
    .toISOString()
    .split("T")[0];

  const { data: custData, error: custError } = await supabase.rpc(
    "get_department_customer_metrics",
    {
      departamento_nome: "Brindes",
      ytd_start: startDate,
      ytd_end: endDate,
      lytd_start: lytdStart,
      lytd_end: lytdEnd,
    },
  );

  if (custError) {
    console.error("❌ Error:", custError);
  } else {
    console.log("✅ Success! Rows:", custData?.length || 0);
    if (custData && custData.length > 0) {
      console.log("Sample:", custData[0]);
    }
  }

  console.log("\n5. Testing get_department_pipeline...");
  const { data: pipeData, error: pipeError } = await supabase.rpc(
    "get_department_pipeline",
    {
      departamento_nome: "Brindes",
      start_date: startDate,
      end_date: endDate,
    },
  );

  if (pipeError) {
    console.error("❌ Error:", pipeError);
  } else {
    console.log("✅ Success! Rows:", pipeData?.length || 0);
    if (pipeData && pipeData.length > 0) {
      console.log("Sample:", pipeData[0]);
    }
  }
}

testFunctions()
  .then(() => {
    console.log("\n✅ All tests complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
