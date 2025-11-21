import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Auto-mark items as facturado for converted quotes
 *
 * NEW APPROACH: Get all unfacturado items, check if their quotes have invoices
 */
export async function POST(request: Request) {
  try {
    // Step 1: Authenticate
    const cookieStore = cookies();
    const authClient = await createServerClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 2: Use admin client for queries
    const supabase = createAdminClient();

    console.log("?? Checking unfacturado items for converted quotes");

    // Step 3: Get all items where facturado=false with their job info
    const { data: unfacturedItems, error: itemsError } = await supabase
      .from("items_base")
      .select(
        `
        id,
        folha_obra_id,
        facturado,
        folhas_obras!inner (
          numero_fo:Numero_do_,
          numero_orc
        )
      `,
      )
      .eq("facturado", false)
      .not("folhas_obras.numero_orc", "is", null);

    if (itemsError) {
      console.error("? Error fetching unfactured items:", itemsError);
      return NextResponse.json(
        { error: "Failed to fetch items", details: itemsError },
        { status: 500 },
      );
    }

    console.log("?? Step 3 - Unfactured items with quotes:", {
      count: unfacturedItems?.length ?? 0,
      sample: unfacturedItems?.slice(0, 3).map((i: any) => ({
        fo: i.folhas_obras?.numero_fo,
        orc: i.folhas_obras?.numero_orc,
      })),
    });

    if (!unfacturedItems || unfacturedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unfactured items with quotes found",
        itemsMarked: 0,
      });
    }

    // Step 4: Get unique quote numbers from these items (as stored in folhas_obras)
    const quoteNumbers = [
      ...new Set(
        unfacturedItems
          .map((item: any) => item.folhas_obras?.numero_orc)
          .filter((orc: any) => orc !== null && orc !== undefined),
      ),
    ];

    // Normalize quote numbers as trimmed strings to match phc.bo.document_number (TEXT)
    const normalizedQuoteNumbers = quoteNumbers.map((q) => String(q).trim());

    console.log("?? Step 4 - Quote numbers for BO lookup:", {
      totalQuotes: quoteNumbers.length,
      normalizedSample: normalizedQuoteNumbers.slice(0, 5),
    });

    if (normalizedQuoteNumbers.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "No valid quote numbers found for unfacturado items with quotes",
        itemsMarked: 0,
      });
    }

    // Step 4: Get BO records for these quotes using RPC (avoids permission issues)
    const { data: boData, error: boError } = await supabase.rpc(
      "get_quotes_by_numbers",
      {
        quote_numbers: normalizedQuoteNumbers,
      },
    );

    if (boError) {
      console.error("? Error fetching BO data:", boError);
      return NextResponse.json(
        { error: "Failed to fetch quote data", details: boError },
        { status: 500 },
      );
    }

    console.log("?? Step 4 - BO Data:", {
      count: boData?.length ?? 0,
      sample: boData?.slice(0, 3),
    });

    if (!boData || boData.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No BO records found for these quotes",
        itemsMarked: 0,
      });
    }

    const documentIds = boData.map((bo) => bo.document_id);

    // Step 5: Check BI table - find which quotes have been invoiced (using RPC)
    const { data: biData, error: biError } = await supabase.rpc(
      "get_bi_by_document_ids",
      {
        doc_ids: documentIds,
      },
    );

    if (biError) {
      console.error("? Error fetching BI data:", biError);
      return NextResponse.json(
        { error: "Failed to fetch bridge data", details: biError },
        { status: 500 },
      );
    }

    console.log("?? Step 5 - BI Data:", {
      count: biData?.length ?? 0,
      sample: biData?.slice(0, 3),
    });

    if (!biData || biData.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No invoices found for these quotes",
        itemsMarked: 0,
      });
    }

    // Get bistamps to check against FI/FT
    const bistamps = biData.map((bi) => bi.line_id);

    // Step 6: Check FI table to verify these bistamps have invoices (using RPC)
    const { data: fiData, error: fiError } = await supabase.rpc(
      "get_fi_by_bistamps",
      {
        bistamp_list: bistamps,
      },
    );

    if (fiError) {
      console.error("? Error fetching FI data:", fiError);
      return NextResponse.json(
        { error: "Failed to fetch invoice line data", details: fiError },
        { status: 500 },
      );
    }

    console.log("?? Step 6 - FI Data:", {
      count: fiData?.length ?? 0,
      sample: fiData?.slice(0, 3),
    });

    if (!fiData || fiData.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No FI records found",
        itemsMarked: 0,
      });
    }

    const invoiceIds = fiData.map((fi) => fi.invoice_id);

    // Step 7: Check FT table to verify these are valid non-cancelled invoices (using RPC)
    const { data: ftData, error: ftError } = await supabase.rpc(
      "get_ft_by_invoice_ids",
      {
        inv_ids: invoiceIds,
      },
    );

    if (ftError) {
      console.error("? Error fetching FT data:", ftError);
      return NextResponse.json(
        { error: "Failed to fetch invoice data", details: ftError },
        { status: 500 },
      );
    }

    console.log("?? Step 7 - FT Data (valid invoices):", {
      count: ftData?.length ?? 0,
    });

    if (!ftData || ftData.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid invoices found",
        itemsMarked: 0,
      });
    }

    // Get valid invoice IDs
    const validInvoiceIds = ftData.map((ft) => ft.invoice_id);

    // Get bistamps that have valid invoices
    const validBistamps = fiData
      .filter((fi) => validInvoiceIds.includes(fi.invoice_id))
      .map((fi) => fi.bistamp);

    // Get document_ids that have valid invoices
    const validDocumentIds = biData
      .filter((bi) => validBistamps.includes(bi.line_id))
      .map((bi) => bi.document_id);

    // Get quote numbers that have valid invoices (as TEXT)
    const invoicedQuotes = boData
      .filter((bo) => validDocumentIds.includes(bo.document_id))
      .map((bo) => bo.document_number);

    console.log(
      `? Step 8 - Found ${invoicedQuotes.length} quotes with valid invoices:`,
      invoicedQuotes,
    );

    if (invoicedQuotes.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Checked ${quoteNumbers.length} quotes, none have valid invoices`,
        itemsMarked: 0,
      });
    }

    // Step 9: Find items that belong to jobs with these invoiced quotes
    // Normalize both sides to trimmed strings so they match BO.document_number (TEXT)
    const invoicedQuotesSet = new Set(
      invoicedQuotes.map((q) => String(q).trim()),
    );

    const itemsToMark = unfacturedItems.filter((item: any) => {
      const orc = item.folhas_obras?.numero_orc;
      if (orc === null || orc === undefined) {
        return false;
      }
      return invoicedQuotesSet.has(String(orc).trim());
    });

    console.log("?? Step 9 - Items matching invoiced quotes (sample):", {
      totalItemsToMark: itemsToMark.length,
      sample: itemsToMark.slice(0, 10).map((item: any) => ({
        id: item.id,
        folha_obra_id: item.folha_obra_id,
        numero_orc: item.folhas_obras?.numero_orc,
        numero_fo: item.folhas_obras?.numero_fo,
        facturado: item.facturado,
      })),
    });

    if (itemsToMark.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Found ${invoicedQuotes.length} invoiced quotes but no matching items`,
        itemsMarked: 0,
      });
    }

    const itemIds = itemsToMark.map((item: any) => item.id);

    console.log(`?? Step 9 - Marking ${itemIds.length} items as facturado`, {
      itemIdsSample: itemIds.slice(0, 10),
    });

    // Step 10: Mark these items as facturado
    const { data: updatedItems, error: updateError } = await supabase
      .from("items_base")
      .update({ facturado: true })
      .in("id", itemIds)
      .select("id, folha_obra_id, facturado");

    if (updateError) {
      console.error("? Error marking items as facturado:", updateError);
      return NextResponse.json(
        { error: "Failed to mark items as facturado", details: updateError },
        { status: 500 },
      );
    }

    const itemsMarkedCount = updatedItems?.length ?? 0;

    console.log("?? Step 10 - Update Result:", {
      itemsMarked: itemsMarkedCount,
      items: updatedItems?.slice(0, 10).map((i) => ({
        id: i.id,
        folha_obra_id: i.folha_obra_id,
        facturado: i.facturado,
      })),
    });

    console.log(
      `? Marked ${itemsMarkedCount} item(s) as facturado for ${invoicedQuotes.length} quote(s)`,
    );

    // Get job numbers for response
    const markedJobs = [
      ...new Set(
        itemsToMark.map((item: any) => ({
          fo: item.folhas_obras?.numero_fo,
          orc: item.folhas_obras?.numero_orc,
        })),
      ),
    ];

    return NextResponse.json({
      success: true,
      message: `Found ${invoicedQuotes.length} converted quote(s), marked ${itemsMarkedCount} item(s) as facturado`,
      itemsMarked: itemsMarkedCount,
      quoteNumbers: invoicedQuotes,
      jobsUpdated: markedJobs,
    });
  } catch (error) {
    console.error("Error in auto-dismiss-converted route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
