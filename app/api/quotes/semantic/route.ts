import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Semantic Quote Search API
 *
 * Uses vector embeddings for meaning-based search.
 * User describes what they want in natural language,
 * and we find quotes with similar descriptions.
 *
 * POST /api/quotes/semantic
 * Body: { query: "display para prateleira de supermercado" }
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openRouterApiKey = process.env.OPENROUTER_API_KEY!;

interface QtyLine {
  qty: number;
  total: number;
  unit_price: number;
  description: string;
}

interface SearchResult {
  document_number: string;
  document_date: string;
  total_value: number;
  description_preview: string;
  qty_lines: QtyLine[];
  similarity: number;
}

/**
 * Get embedding vector for a text using OpenRouter API
 */
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "IMACX Quote Search",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text.substring(0, 8000 * 4), // Truncate if too long
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query, limit = 20, threshold = 0.3 } = body;

    // Validate input
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 },
      );
    }

    if (query.trim().length < 3) {
      return NextResponse.json(
        { error: "Query must be at least 3 characters" },
        { status: 400 },
      );
    }

    // Check for OpenRouter API key
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    // Step 1: Convert query to embedding
    const queryEmbedding = await getEmbedding(query.trim());

    // Step 2: Search for similar quotes using pgvector
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_quotes_by_embedding",
      {
        query_embedding: queryEmbedding,
        match_count: limit,
        similarity_threshold: threshold,
      },
    );

    if (searchError) {
      console.error("Semantic search error:", searchError);
      return NextResponse.json(
        { error: "Semantic search failed", details: searchError.message },
        { status: 500 },
      );
    }

    const results: SearchResult[] = searchResults || [];

    // Step 3: Calculate price statistics from results
    let priceStats = null;
    if (results.length > 0) {
      const unitPrices: number[] = [];

      results.forEach((r) => {
        if (r.qty_lines && r.qty_lines.length > 0) {
          // Get main line (highest unit price)
          const validLines = r.qty_lines.filter(
            (line) =>
              line.unit_price &&
              line.unit_price > 0 &&
              line.qty &&
              line.qty > 0,
          );
          if (validLines.length > 0) {
            validLines.sort(
              (a, b) => (b.unit_price || 0) - (a.unit_price || 0),
            );
            unitPrices.push(validLines[0].unit_price);
          }
        }
      });

      // Filter outliers
      const filteredPrices = unitPrices.filter((p) => p >= 1 && p <= 5000);

      if (filteredPrices.length > 0) {
        const avg =
          filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length;
        priceStats = {
          min: Math.min(...filteredPrices),
          max: Math.max(...filteredPrices),
          typical: Math.round(avg * 100) / 100,
          count: filteredPrices.length,
        };
      }
    }

    // Return response
    return NextResponse.json({
      success: true,
      query: query.trim(),
      method: "semantic",
      results: results.map((r) => ({
        document_number: r.document_number,
        document_date: r.document_date,
        total_value: r.total_value,
        description_preview: r.description_preview,
        qty_lines: r.qty_lines,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
      priceStats,
      count: results.length,
      searchTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
