import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Quote Search API
 *
 * EXPERIMENTAL - Uses temp tables only (quote_search_summaries)
 * Does NOT touch production phc.bo or phc.bi
 *
 * POST /api/quotes/search
 * Body: { query: "expositor cartao 3mm prateleiras", limit?: 10 }
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SearchResult {
  document_number: string;
  document_date: string;
  total_value: number;
  description_preview: string;
  qty_lines: Array<{
    qty: number;
    total: number;
    unit_price: number;
    description: string;
  }>;
  keyword_matches: number;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 },
      );
    }

    // Clean the query - remove extra whitespace
    const cleanQuery = query.trim().toLowerCase();

    if (cleanQuery.length < 3) {
      return NextResponse.json(
        { error: "Query must be at least 3 characters" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the search function - let DB do the matching
    const { data, error } = await supabase.rpc("search_quotes_by_keywords", {
      keywords: cleanQuery,
      match_count: Math.min(limit, 50), // Cap at 50
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500 },
      );
    }

    // Format response - no additional filtering for standard search
    const results: SearchResult[] = (data || []).map((row: SearchResult) => ({
      document_number: row.document_number,
      document_date: row.document_date,
      total_value: row.total_value,
      description_preview: row.description_preview,
      qty_lines: row.qty_lines || [],
      keyword_matches: row.keyword_matches,
      similarity: Math.round(row.similarity * 1000) / 1000,
    }));

    return NextResponse.json({
      query: cleanQuery,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("Quote search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Also support GET for simple testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query) {
    return NextResponse.json(
      {
        error: "Query parameter 'q' is required",
        usage: "/api/quotes/search?q=expositor+cartao+prateleiras&limit=10",
      },
      { status: 400 },
    );
  }

  // Reuse POST logic
  const fakeRequest = {
    json: async () => ({ query, limit }),
  } as NextRequest;

  return POST(fakeRequest);
}
