import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * AI GUESS - Quote Price Estimator API
 *
 * Takes a product description and estimates prices at standard quantity tiers
 * using historical quote data and AI analysis.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openRouterApiKey = process.env.OPENROUTER_API_KEY!;

const QUANTITY_TIERS = [1, 30, 50, 100, 250, 350];

// Parse quantity from user query (e.g., "crowner extensível quantidade 100")
function parseQueryForQuantity(input: string): {
  product: string;
  qty: number | null;
} {
  const qtyPatterns = [
    /\b(?:quantidade|qt|qts|qtd|qty)\s*[:.]?\s*(\d+)\b/i,
    /\b(\d+)\s*(?:un|uns|unidades?)\b/i,
  ];

  let qty: number | null = null;
  let cleanQuery = input;

  for (const pattern of qtyPatterns) {
    const match = input.match(pattern);
    if (match) {
      qty = parseInt(match[1], 10);
      cleanQuery = input.replace(pattern, "").trim();
      break;
    }
  }

  // Also remove trailing numbers that look like quantities
  cleanQuery = cleanQuery.replace(/\s+\d+\s*$/, "").trim();

  return { product: cleanQuery, qty };
}

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
  keyword_matches: number;
  similarity: number;
}

interface PriceEstimate {
  qty: number;
  unit_price: number;
  total_price: number;
  confidence: "alta" | "media" | "baixa";
}

interface EstimateResponse {
  produto: string;
  estimativas: PriceEstimate[];
  matches_found: number;
  date_range: string;
  assumptions: string[];
  notes?: string;
}

const SYSTEM_PROMPT = `You are a pricing estimator for IMACX, a Portuguese PLV/printing company.

Given similar historical quotes, estimate prices for the requested product at these quantity tiers: 1, 30, 50, 100, 250, 350+.

PRICING PATTERNS FROM DATA:
- Volume discounts typically 20-40% from qty 1 to qty 100+
- Discount curve: qty 1 (base) → 30 (-15%) → 50 (-25%) → 100 (-35%) → 250 (-45%) → 350+ (-50%)
- Small quantities (<10) have setup cost premium

REFERENCE PRICES (EUR/unit at qty 100, production quantities):
- Expositor simples (3-4 prat): 35-55 EUR
- Expositor médio (5 prat): 50-80 EUR
- Expositor especial/3D: 100-250 EUR
- Crowner simples: 3-8 EUR
- Crowner extensível: 8-15 EUR
- Vinil EasyDot (A2): 2-4 EUR
- Vinil chão/floorgraphics: 3-6 EUR
- Caixa/carapuça cartão: 2-5 EUR
- Standup/Totem: 40-100 EUR
- Ilha/Centro ilha: 50-200 EUR
- Honeycomb/Favo/Alveolar: adds 10-20 EUR
- Display/Expositor especial: 80-150 EUR

SYNONYMS TO UNDERSTAND:
- "floor graphics" = "vinil chão" = "floorgraphics"
- "display" = "expositor"
- "honeycomb" = "favo" = "alveolar"
- "caixa" = "carapuça"
- "crowner" = "topo" = "topper"

RULES:
1. Analyze the provided historical quotes to extract actual pricing patterns
2. Weight recent quotes more heavily
3. Adjust for material complexity and size
4. Always show prices as approximations
5. Include confidence level based on match quality:
   - "alta": 5+ matching quotes with similar specs
   - "media": 2-4 matching quotes OR extrapolated from similar products
   - "baixa": <2 matches, significant extrapolation needed
6. For 350+ qty, if data is sparse, still estimate based on curve
7. Note assumed materials/specs based on typical configurations
8. Respond ONLY with valid JSON, no markdown

OUTPUT JSON FORMAT (respond with ONLY this JSON, no other text):
{
  "produto": "interpreted product description in Portuguese",
  "estimativas": [
    {"qty": 1, "unit_price": 85, "total_price": 85, "confidence": "baixa"},
    {"qty": 30, "unit_price": 62, "total_price": 1860, "confidence": "media"},
    {"qty": 50, "unit_price": 55, "total_price": 2750, "confidence": "media"},
    {"qty": 100, "unit_price": 48, "total_price": 4800, "confidence": "alta"},
    {"qty": 250, "unit_price": 42, "total_price": 10500, "confidence": "alta"},
    {"qty": 350, "unit_price": 38, "total_price": 13300, "confidence": "media"}
  ],
  "matches_found": 12,
  "date_range": "Dez 2024 - Nov 2025",
  "assumptions": ["Cartão 3mm", "Favo 16mm", "Impressão 4/0"],
  "notes": "Optional notes about the estimation"
}`;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query, model = "google/gemini-2.5-flash-lite" } = body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { error: "Product description is required (min 3 characters)" },
        { status: 400 },
      );
    }

    // Parse query to extract quantity and clean product name
    const { product: cleanProduct, qty: targetQty } = parseQueryForQuantity(
      query.trim(),
    );

    if (cleanProduct.length < 3) {
      return NextResponse.json(
        {
          error:
            "Product description is required (min 3 characters after removing quantity)",
        },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Search for similar quotes using CLEAN product name (without quantity)
    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_quotes_by_keywords",
      {
        keywords: cleanProduct.toLowerCase(),
        match_count: 50,
      },
    );

    if (searchError) {
      console.error("Search error:", searchError);
      return NextResponse.json(
        { error: "Database search failed", details: searchError.message },
        { status: 500 },
      );
    }

    const quotes: SearchResult[] = searchResults || [];

    if (quotes.length === 0) {
      return NextResponse.json({
        success: false,
        error: "no_matches",
        message:
          "Nenhum orçamento similar encontrado. Tente outras palavras-chave.",
        searchTime: Date.now() - startTime,
      });
    }

    // Step 2: Prepare quote data for AI
    const quoteSummary = quotes
      .slice(0, 30)
      .map((q) => {
        const priceLines = q.qty_lines
          .filter((l) => l.qty > 0 && l.unit_price > 0)
          .map(
            (l) =>
              `  - Qty ${l.qty}: ${l.unit_price.toFixed(2)} EUR/un (total: ${l.total.toFixed(2)} EUR)`,
          )
          .join("\n");

        return `Orçamento #${q.document_number} (${q.document_date}):
${q.description_preview?.substring(0, 300) || "Sem descrição"}
Preços:
${priceLines || "  Sem linhas de preço"}
---`;
      })
      .join("\n\n");

    // Step 3: Call AI for price estimation
    const targetQtyText = targetQty
      ? `\nQUANTIDADE ALVO DO CLIENTE: ${targetQty} unidades (destaca esta quantidade na resposta)`
      : "";

    const userPrompt = `PRODUTO A ESTIMAR: "${cleanProduct}"${targetQtyText}

ORÇAMENTOS HISTÓRICOS SIMILARES (${quotes.length} encontrados):

${quoteSummary}

Com base nestes orçamentos históricos, estima os preços para o produto pedido nas quantidades padrão (1, 30, 50, 100, 250, 350+).
Responde APENAS com o JSON no formato especificado.`;

    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "IMACX Quote Estimator",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      },
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter error:", errorText);
      return NextResponse.json(
        { error: "AI service error", details: errorText },
        { status: 500 },
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    // Step 4: Parse AI response
    let estimate: EstimateResponse;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      estimate = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: aiContent },
        { status: 500 },
      );
    }

    // Step 5: Return results
    return NextResponse.json({
      success: true,
      query,
      estimate,
      similarQuotes: quotes.slice(0, 10).map((q) => ({
        document_number: q.document_number,
        document_date: q.document_date,
        total_value: q.total_value,
        description_preview: q.description_preview?.substring(0, 150),
        qty_lines: q.qty_lines.filter((l) => l.qty > 0).slice(0, 5),
      })),
      usage: aiData.usage,
      model,
      searchTime: Date.now() - startTime,
    });
  } catch (err) {
    console.error("Estimate API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
