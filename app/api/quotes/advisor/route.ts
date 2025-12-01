import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * AI Quote Advisor API
 *
 * Two-stage approach:
 * 1. Standard keyword search finds candidates
 * 2. AI refines results - filters out irrelevant quotes and estimates pricing
 *
 * POST /api/quotes/advisor
 * Body: { query: "expositor 5 prateleiras cartao favo", mode: "simple" | "extended" }
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

interface AIAnalysis {
  priceEstimate: {
    min: number;
    max: number;
    typical: number;
    currency: string;
    confidence: "high" | "medium" | "low";
    perUnit?: {
      min: number;
      max: number;
      typicalQty: number;
    };
  };
  reasoning: string;
  keyFactors?: string[];
  recommendations?: string[];
  warnings?: string[];
  filteredOutReasons?: string[];
}

interface AIFilterResponse {
  relevantQuotes: number[];
  filteredOut: { quoteIndex: number; reason: string }[];
  priceEstimate: {
    min: number;
    max: number;
    typical: number;
    confidence: "high" | "medium" | "low";
    perUnit?: { min: number; max: number; typicalQty: number };
  };
  reasoning: string;
  keyFactors?: string[];
  recommendations?: string[];
  warnings?: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      query,
      mode = "simple",
      model = "anthropic/claude-3.5-sonnet",
    } = body;

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

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    // Step 1: Standard keyword search to find candidates
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Fetch ALL matching results from database (no limit - free search)
    const fetchLimit = 100; // Max to avoid timeout, but effectively "all"

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_quotes_by_keywords",
      {
        keywords: query.trim().toLowerCase(),
        match_count: fetchLimit,
      },
    );

    if (searchError) {
      console.error("Search error:", searchError);
      return NextResponse.json(
        { error: "Database search failed", details: searchError.message },
        { status: 500 },
      );
    }

    const candidateQuotes: SearchResult[] = searchResults || [];

    // If no candidates found, return early
    if (candidateQuotes.length === 0) {
      return NextResponse.json({
        success: true,
        query: query.trim(),
        mode,
        analysis: {
          priceEstimate: {
            min: 0,
            max: 0,
            typical: 0,
            currency: "EUR",
            confidence: "low",
          },
          reasoning:
            "Nao foram encontrados orcamentos com estas palavras-chave na base de dados.",
        },
        similarQuotes: [],
        searchTime: Date.now() - startTime,
      });
    }

    // Step 2: Prepare data for AI refinement
    const quoteSummaries = candidateQuotes
      .map((q, i) => {
        const qtyInfo =
          q.qty_lines && q.qty_lines.length > 0
            ? q.qty_lines
                .slice(0, 4)
                .map(
                  (line) =>
                    `    - ${line.qty?.toLocaleString("pt-PT") || "?"} un @ ${line.unit_price?.toFixed(2) || "?"} EUR = ${line.total?.toLocaleString("pt-PT") || "?"} EUR total`,
                )
                .join("\n")
            : "    - Sem detalhes de quantidade";

        return `[${i}] Orc #${q.document_number} (${q.document_date}) - ${q.total_value?.toLocaleString("pt-PT") || 0} EUR
${qtyInfo}
   Desc: ${q.description_preview?.substring(0, 300) || "N/A"}`;
      })
      .join("\n\n");

    // Step 3: Build AI prompt - ask AI to FILTER and then estimate
    const systemPrompt = `Es um especialista em pricing para a IMACX, empresa portuguesa de impressao e produtos promocionais (PLV).
A tua tarefa e FILTRAR orcamentos irrelevantes e fornecer estimativa de preco baseada apenas nos relevantes.
Responde sempre em Portugues (PT-PT). Se preciso e direto.

## VOCABULARIO E SINONIMOS IMACX

### PRODUTOS (sinonimos)
- CROWNER: crowner topo, crowner linear, crowner duplo, crowner extensivel, crowner carapuca
- EXPOSITOR: expositor balcao, expositor solo, expositor chao, FSDU, tower, dispenser, podio, expositor especial, expositor pequeno/medio/grande, display (EN)
- ILHA: ilha JMF, ilha palete, ilha favo, ilha premium, centro de ilha, forra ilha, kit ilha
- VINIL CHAO: vinil chao, floorgraphics, floor graphics, autocolante chao, vinil solo
- VINIL: vinil impressao, vinil autocolante, easydot, blockout, vinil transparente, vinil fosco, vinil viatura, vinil electroestatico, autocolante
- PLACA: placa PVC, placa aberto/fechado, cartela, ficticio, sinaletica
- TOTEM: totem oval, standup, stand-up, prisma, eco totem
- CARTAZ: cartaz topo, poster
- CAIXA: caixa, carapuca, caixa transporte, caixa gift, caixa bombons, caixote, cubo

### MATERIAIS (espessuras tipicas)
- CARTAO: 2mm, 3mm, 4mm (kraft, liso, eska, duplo micro, cartolina, FSC)
- FAVO: 16mm (BR/BR), 3mm F/V - honeycomb (EN), alveolar - estruturas leves e rigidas
- PVC: 1mm, 2mm, 3mm, 5mm, 8mm (branco, preto)
- PPA: 3.5mm, 5mm, 8mm - polipropileno alveolar, PP alveolar, alveolar - placas rigidas
- REBOARD: 16mm - similar ao favo, honeycomb board
- DIBOND: 3mm - placas compostas aluminio
- VINIL: EasyDot, Blockout, Transparente, Fosco, Electroestatico, Cast
- LAMINACAO: mate, brilho, floorgraphics (para chao)

### COMPONENTES DE EXPOSITORES (todos FAZEM PARTE do expositor)
- PRATELEIRA: prateleiras, 3 prat, 4 prat, 5 prat, camadas
- LATERAL: laterais (duplas/simples), lados
- TRASEIRA: traseira, costas, fundo
- BATENTE: batentes, batente base, stops
- BASE: base (cartao, PPA, madeira), fundo
- CROWNER: crowner, topo, header
- REGUA PORTA PRECOS: regua porta precos, price rail (cartolina, plastico)
- CRUZETA: cruzetas, reforco interno, estrutura interna
- NINHO: ninhos frontais, compartimentos
- CAIXA TRANSPORTE: caixa transporte, cx kraft, embalagem

### REGRAS IMPORTANTES
1. Expositores TEM laterais, topos, bases - sao componentes, NAO produtos separados
2. "Cartao favo" = expositor com cartao E favo (materiais misturados e normal)
3. Quantidades diferentes = util para ver curva de desconto
4. Numero de prateleiras: "3 prat", "4 prat", "5 prat" nas descricoes`;

    const userPrompt =
      mode === "extended"
        ? `# ANALISE DE ORCAMENTO

## Pedido do Cliente
"${query}"

## Orcamentos Candidatos (da pesquisa por palavras-chave)
${quoteSummaries}

## TAREFA - DUAS ETAPAS

### ETAPA 1: FILTRAR (CONSERVADOR - NAO EXCLUIR EM DUVIDA)
Analisa cada orcamento e determina se e RELEVANTE para o pedido.

REGRAS IMPORTANTES - SE CAUTELOSO:
- Se o cliente pede "5 prateleiras", exclui APENAS se o numero de prateleiras e claramente diferente
- Se pede "cartao favo", MANTEM se favo estiver presente (mesmo misturado com outros materiais)
- Se pede "expositor", MANTEM tudo que contenha a palavra "expositor" na descricao
  - Expositores tem componentes como laterais, topos, bases - NAO excluir por ter estas palavras
  - So excluir se for APENAS laterais/decoracoes SEM mencionar expositor
- Quantidade NAO e criterio de exclusao (diferentes quantidades sao uteis para comparar precos)
- EM CASO DE DUVIDA, MANTEM o orcamento (melhor ter mais do que perder relevantes)

### ETAPA 2: ESTIMAR PRECO
Com base APENAS nos orcamentos relevantes, fornece:
1. Estimativa de preco (min/max/tipico)
2. Preco por unidade se aplicavel
3. Raciocinio (2-3 frases)
4. Fatores chave (3-5 pontos)
5. Recomendacoes (2-3 pontos)
6. Alertas se houver

REFERENCIAS DE PRECO TIPICO (quantidades producao 100-500 un):
- Expositor cartao/favo simples: 35-50 EUR/un (100-400 un)
- Expositor especial/3D: 150-250 EUR/un (50-100 un)
- Vinil EasyDot 50x70cm: 2.45-2.60 EUR/un (700-2000 un)
- Vinil chao/floorgraphics: 2.70-3.00 EUR/un (1000+ un)
- Crowner topo: 5-9 EUR/un (200 un)
- Caixa cartao kraft: 2.50-3.50 EUR/un (500-1000 un)
- Standup/Totem favo: 37-78 EUR/un (60-240 un)
- Centro ilha simples: 15-50 EUR/un (100 un)
- Centro ilha especial/3D: 200-300 EUR/un (50-100 un)
- Clipstrip simples: 4-8 EUR/un (1000+ un)
- Dispenser complexo: 50-75 EUR/un (350 un)
NOTA: Prototipos (qty 1) custam 5-10x mais que producao

Responde em JSON:
{
  "relevantQuotes": [0, 2, 5],  // indices dos orcamentos relevantes
  "filteredOut": [
    {"quoteIndex": 1, "reason": "Apenas laterais avulso, sem expositor"},
    {"quoteIndex": 3, "reason": "Cartao micro SEM favo presente"}
  ],
  "priceEstimate": {
    "min": number,
    "max": number,
    "typical": number,
    "confidence": "high" | "medium" | "low",
    "perUnit": {"min": number, "max": number, "typicalQty": number}
  },
  "reasoning": "string",
  "keyFactors": ["string"],
  "recommendations": ["string"],
  "warnings": ["string"]
}`
        : `# ANALISE RAPIDA

## Pedido
"${query}"

## Candidatos (mostram preco UNITARIO apos @)
${quoteSummaries}

## TAREFA
1. FILTRA (CONSERVADOR): quais orcamentos sao relevantes?
   - Se pede "expositor", MANTEM tudo com palavra "expositor" (mesmo com laterais/topos/bases)
   - Se pede "cartao favo", MANTEM se favo presente (mesmo misturado com outros)
   - So exclui se CLARAMENTE irrelevante
   - EM DUVIDA, MANTEM
2. ESTIMA PRECO UNITARIO: com base nos relevantes, qual o preco POR UNIDADE esperado?
   - USA os precos unitarios (valor apos @) NAO o total
   - min/max/typical sao precos POR UNIDADE em EUR

JSON:
{
  "relevantQuotes": [indices],
  "filteredOut": [{"quoteIndex": n, "reason": "motivo breve"}],
  "priceEstimate": {"min": n, "max": n, "typical": n, "confidence": "high|medium|low"},
  "reasoning": "1-2 frases sobre preco unitario"
}`;

    // Step 4: Call OpenRouter API
    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "IMACX Quote Advisor",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: mode === "extended" ? 3000 : 1500,
        }),
      },
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: "AI analysis failed", details: errorText },
        { status: aiResponse.status },
      );
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || "";

    // Step 5: Parse AI response
    let aiFilter: AIFilterResponse;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiFilter = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      // Fallback: use MAIN line item (highest value line) from each quote
      // This avoids including cheap components like réguas, porta-preços etc
      const mainLinePrices: number[] = [];
      candidateQuotes.forEach((q) => {
        if (q.qty_lines && q.qty_lines.length > 0) {
          // Find the main/primary line (highest unit_price with qty > 0)
          const validLines = q.qty_lines.filter(
            (line) =>
              line.unit_price &&
              line.unit_price > 0 &&
              line.qty &&
              line.qty > 0,
          );
          if (validLines.length > 0) {
            // Sort by unit_price desc and take the highest (main product)
            validLines.sort(
              (a, b) => (b.unit_price || 0) - (a.unit_price || 0),
            );
            mainLinePrices.push(validLines[0].unit_price);
          }
        }
      });

      // Filter out extreme outliers (prices below 1€ or above 5000€)
      const filteredPrices = mainLinePrices.filter((p) => p >= 1 && p <= 5000);

      const avgUnitPrice =
        filteredPrices.length > 0
          ? filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length
          : 0;

      aiFilter = {
        relevantQuotes: candidateQuotes.map((_, i) => i),
        filteredOut: [],
        priceEstimate: {
          min: filteredPrices.length > 0 ? Math.min(...filteredPrices) : 0,
          max: filteredPrices.length > 0 ? Math.max(...filteredPrices) : 0,
          typical: Math.round(avgUnitPrice * 100) / 100,
          confidence: "low",
        },
        reasoning:
          "Estimativa baseada nos produtos principais dos orcamentos encontrados (analise AI falhou).",
      };
    }

    // Step 6: Build filtered results
    const relevantIndices = new Set(aiFilter.relevantQuotes || []);
    const filteredQuotes = candidateQuotes.filter((_, i) =>
      relevantIndices.has(i),
    );

    // Build analysis response
    const analysis: AIAnalysis = {
      priceEstimate: {
        min: aiFilter.priceEstimate?.min || 0,
        max: aiFilter.priceEstimate?.max || 0,
        typical: aiFilter.priceEstimate?.typical || 0,
        currency: "EUR",
        confidence: aiFilter.priceEstimate?.confidence || "low",
        perUnit: aiFilter.priceEstimate?.perUnit,
      },
      reasoning: aiFilter.reasoning || "Sem raciocinio disponivel.",
      keyFactors: aiFilter.keyFactors,
      recommendations: aiFilter.recommendations,
      warnings: aiFilter.warnings,
      filteredOutReasons: aiFilter.filteredOut?.map(
        (f) =>
          `#${candidateQuotes[f.quoteIndex]?.document_number}: ${f.reason}`,
      ),
    };

    // Step 7: Return response
    return NextResponse.json({
      success: true,
      query: query.trim(),
      mode,
      analysis,
      similarQuotes: filteredQuotes.map((q) => ({
        document_number: q.document_number,
        document_date: q.document_date,
        total_value: q.total_value,
        description_preview: q.description_preview,
        qty_lines: q.qty_lines,
        similarity: Math.round(q.similarity * 100) / 100,
      })),
      totalCandidates: candidateQuotes.length,
      filteredCount: filteredQuotes.length,
      usage: aiResult.usage,
      model: aiResult.model,
      searchTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Quote advisor error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
