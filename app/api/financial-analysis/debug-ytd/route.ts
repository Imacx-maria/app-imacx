import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * DEBUG ENDPOINT: /api/financial-analysis/debug-ytd
 *
 * This endpoint helps diagnose YTD revenue calculation issues by:
 * - Showing raw data counts
 * - Breaking down filtering logic
 * - Comparing different calculation methods
 * - Displaying sample records
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
    const now = new Date();
    const currentYear = now.getFullYear();
    const ytdStart = new Date(currentYear, 0, 1);
    const ytdEnd = now;

    console.log("\n========================================");
    console.log("🔍 YTD DEBUG ANALYSIS");
    console.log("========================================");
    console.log(
      `Date Range: ${ytdStart.toISOString().split("T")[0]} → ${ytdEnd.toISOString().split("T")[0]}`,
    );
    console.log(`Current Year: ${currentYear}`);

    // Fetch ALL records for YTD (no filters)
    const { data: allRecords, error: allError } = await supabase
      .schema("phc")
      .from("ft")
      .select(
        "invoice_id, invoice_date, customer_id, net_value, document_type, anulado",
      )
      .gte("invoice_date", ytdStart.toISOString().split("T")[0])
      .lte("invoice_date", ytdEnd.toISOString().split("T")[0])
      .limit(50000)
      .order("invoice_date", { ascending: true });

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    console.log(`\n📊 Total records fetched: ${allRecords?.length || 0}`);

    // Analyze document types
    const documentTypeCounts = new Map<string, number>();
    const anuladoCounts = new Map<string, number>();

    for (const record of allRecords || []) {
      // Count document types
      const docType = record.document_type || "(null)";
      documentTypeCounts.set(
        docType,
        (documentTypeCounts.get(docType) || 0) + 1,
      );

      // Count anulado values
      const anuladoValue =
        record.anulado === null
          ? "(null)"
          : record.anulado === undefined
            ? "(undefined)"
            : String(record.anulado);
      anuladoCounts.set(
        anuladoValue,
        (anuladoCounts.get(anuladoValue) || 0) + 1,
      );
    }

    console.log("\n📋 Document Type Breakdown:");
    for (const [type, count] of documentTypeCounts.entries()) {
      console.log(`  ${type}: ${count} records`);
    }

    console.log("\n🚫 Anulado Field Breakdown:");
    for (const [value, count] of anuladoCounts.entries()) {
      console.log(`  ${value}: ${count} records`);
    }

    // Filter logic 1: Only valid document types
    const validDocTypes = (allRecords || []).filter((inv) => {
      return (
        inv.document_type === "Factura" ||
        inv.document_type === "Nota de Crédito"
      );
    });

    console.log(
      `\n✅ After filtering for Factura + Nota de Crédito: ${validDocTypes.length} records`,
    );

    // Filter logic 2: Exclude cancelled
    const notCancelled = validDocTypes.filter((inv) => {
      return !inv.anulado || inv.anulado !== "True";
    });

    console.log(
      `✅ After excluding anulado='True': ${notCancelled.length} records`,
    );

    // Calculate revenue breakdown
    const facturas = notCancelled.filter(
      (inv) => inv.document_type === "Factura",
    );
    const notasCredito = notCancelled.filter(
      (inv) => inv.document_type === "Nota de Crédito",
    );

    const facturasTotal = facturas.reduce(
      (sum, inv) => sum + (Number(inv.net_value) || 0),
      0,
    );
    const notasCreditoTotal = notasCredito.reduce(
      (sum, inv) => sum + (Number(inv.net_value) || 0),
      0,
    );
    const netRevenue = facturasTotal - notasCreditoTotal;

    console.log("\n💰 REVENUE CALCULATION:");
    console.log(
      `  Facturas: ${facturas.length} records = €${facturasTotal.toFixed(2)}`,
    );
    console.log(
      `  Notas de Crédito: ${notasCredito.length} records = €${notasCreditoTotal.toFixed(2)}`,
    );
    console.log(
      `  Net Revenue (Facturas - Credits): €${netRevenue.toFixed(2)}`,
    );

    // Customer count
    const uniqueCustomers = new Set(
      facturas
        .filter(
          (inv) => inv.customer_id !== null && inv.customer_id !== undefined,
        )
        .map((inv) => String(inv.customer_id)),
    );

    console.log(`\n👥 Unique Customers: ${uniqueCustomers.size}`);

    // Ticket médio
    const avgInvoiceValue =
      facturas.length > 0 ? netRevenue / facturas.length : 0;
    console.log(`🎫 Ticket Médio: €${avgInvoiceValue.toFixed(2)}`);

    // Sample records for inspection
    const sampleFacturas = facturas.slice(0, 3);
    const sampleCreditos = notasCredito.slice(0, 3);

    console.log("\n📄 Sample Facturas (first 3):");
    for (const inv of sampleFacturas) {
      console.log(
        `  ID: ${inv.invoice_id}, Date: ${inv.invoice_date}, Value: €${inv.net_value}, Anulado: ${inv.anulado}`,
      );
    }

    console.log("\n📄 Sample Notas de Crédito (first 3):");
    for (const inv of sampleCreditos) {
      console.log(
        `  ID: ${inv.invoice_id}, Date: ${inv.invoice_date}, Value: €${inv.net_value}, Anulado: ${inv.anulado}`,
      );
    }

    console.log("\n========================================");
    console.log("✅ DEBUG ANALYSIS COMPLETE");
    console.log("========================================\n");

    // Return comprehensive debug response
    const response = {
      debug: true,
      dateRange: {
        start: ytdStart.toISOString().split("T")[0],
        end: ytdEnd.toISOString().split("T")[0],
        year: currentYear,
      },
      rawData: {
        totalRecords: allRecords?.length || 0,
        documentTypes: Object.fromEntries(documentTypeCounts),
        anuladoValues: Object.fromEntries(anuladoCounts),
      },
      filtering: {
        step1_validDocTypes: validDocTypes.length,
        step2_notCancelled: notCancelled.length,
        recordsExcluded: (allRecords?.length || 0) - notCancelled.length,
      },
      calculations: {
        facturas: {
          count: facturas.length,
          totalValue: Math.round(facturasTotal * 100) / 100,
        },
        notasCredito: {
          count: notasCredito.length,
          totalValue: Math.round(notasCreditoTotal * 100) / 100,
        },
        netRevenue: Math.round(netRevenue * 100) / 100,
        uniqueCustomers: uniqueCustomers.size,
        avgInvoiceValue: Math.round(avgInvoiceValue * 100) / 100,
      },
      samples: {
        facturas: sampleFacturas.map((inv) => ({
          invoice_id: inv.invoice_id,
          invoice_date: inv.invoice_date,
          net_value: inv.net_value,
          document_type: inv.document_type,
          anulado: inv.anulado,
        })),
        notasCredito: sampleCreditos.map((inv) => ({
          invoice_id: inv.invoice_id,
          invoice_date: inv.invoice_date,
          net_value: inv.net_value,
          document_type: inv.document_type,
          anulado: inv.anulado,
        })),
      },
      expectedValue: {
        description: "Compare this with your direct SQL query result",
        netRevenue: Math.round(netRevenue * 100) / 100,
        shouldBe: "€3,584,146.76 (if this is the correct SQL result)",
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [Debug YTD] Unexpected Error:", error);
    return NextResponse.json(
      { error: "Failed to generate debug data", details: String(error) },
      { status: 500 },
    );
  }
}
