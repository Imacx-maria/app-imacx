import { NextRequest, NextResponse } from "next/server";

/**
 * AI Financial Report Analysis
 *
 * This endpoint takes financial data and uses AI (via OpenRouter)
 * to generate insights, recommendations, and analysis.
 *
 * Usage:
 * POST /api/ai/analyze-financial-report
 * Body: { kpiData, monthlyRevenue, topCustomers, departments, pipeline }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📊 [AI Analysis] Request received with data:", {
      hasKpiData: !!body.kpiData,
      monthlyRevenueCount: body.monthlyRevenue?.length || 0,
      topCustomersCount: body.topCustomers?.length || 0,
    });

    const {
      kpiData,
      monthlyRevenue,
      topCustomers,
      departments,
      pipeline,
      costCenters,
    } = body;

    // Get OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter API key not configured. Add OPENROUTER_API_KEY to your .env.local",
        },
        { status: 500 },
      );
    }

    // Prepare data summary for AI
    const dataForAI = `
# FINANCIAL DATA ANALYSIS REQUEST

## KPI Summary (YTD)
- Vendas MTD: €${kpiData?.vendas_mtd?.toLocaleString("pt-PT") || 0}
- Vendas YTD: €${kpiData?.vendas_ytd?.toLocaleString("pt-PT") || 0}
- Crescimento YTD: ${kpiData?.vendas_ytd_var_pct?.toFixed(1) || 0}%
- Margem Média: ${kpiData?.margem_media?.toFixed(1) || 0}%
- Número de Clientes: ${kpiData?.num_clientes || 0}
- Ticket Médio: €${kpiData?.ticket_medio?.toLocaleString("pt-PT") || 0}

## Monthly Revenue Trend
${
  Array.isArray(monthlyRevenue)
    ? monthlyRevenue
        .slice(0, 6)
        .map(
          (m: any) =>
            `- ${m.mes || m.month}: Vendas €${m.vendas?.toLocaleString("pt-PT") || 0}, Margem ${m.margem_pct?.toFixed(1) || 0}%`,
        )
        .join("\n")
    : "No data"
}

## Top 5 Customers (YTD)
${
  Array.isArray(topCustomers)
    ? topCustomers
        .slice(0, 5)
        .map(
          (c: any, i: number) =>
            `${i + 1}. ${c.nome || c.cliente}: €${c.total_vendas?.toLocaleString("pt-PT") || 0} (${c.num_faturas || 0} faturas)`,
        )
        .join("\n")
    : "No data"
}

## Department Performance
${
  departments
    ?.map(
      (d: any) =>
        `- ${d.departamento}: €${d.total_orcamentos_ytd?.toLocaleString("pt-PT") || 0} orçamentos, €${d.total_faturas_ytd?.toLocaleString("pt-PT") || 0} faturado, ${d.taxa_conversao?.toFixed(1) || 0}% conversão`,
    )
    .join("\n") || "No data"
}

## Cost Center Performance
${
  costCenters
    ?.map(
      (cc: any) =>
        `- ${cc.cost_center}: €${cc.vendas_ytd?.toLocaleString("pt-PT") || 0}, Crescimento: ${cc.crescimento_pct?.toFixed(1) || 0}%`,
    )
    .join("\n") || "No data"
}

## Commercial Pipeline
- Top 15 Opportunities: €${pipeline?.top15?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0)?.toLocaleString("pt-PT") || 0}
- Needs Attention: €${pipeline?.attention?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0)?.toLocaleString("pt-PT") || 0}
- Lost: €${pipeline?.lost?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0)?.toLocaleString("pt-PT") || 0}
- Approved: €${pipeline?.approved?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0)?.toLocaleString("pt-PT") || 0}

---

TASK: Analyze this financial data and provide:

1. **Executive Summary** (3-4 sentences): Overall business health and main takeaway
2. **Key Insights** (5-7 bullet points): Important patterns, trends, and observations
3. **Opportunities** (3-5 bullet points): Growth opportunities and positive trends to leverage
4. **Risks & Concerns** (3-5 bullet points): Issues that need attention
5. **Actionable Recommendations** (5-7 bullet points): Specific actions to take this month

Write in Portuguese (PT-PT), be direct and data-driven. Focus on actionable insights for executives.
`;

    // Call OpenRouter API
    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "IMACX Financial Analysis",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-sonnet", // Fast and excellent at analysis
          messages: [
            {
              role: "system",
              content:
                "You are a financial analyst for a Portuguese printing and promotional products company (IMACX). Analyze data and provide actionable insights in Portuguese.",
            },
            {
              role: "user",
              content: dataForAI,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      },
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: "Failed to get AI analysis", details: errorText },
        { status: aiResponse.status },
      );
    }

    const aiResult = await aiResponse.json();
    const analysisText =
      aiResult.choices?.[0]?.message?.content || "No analysis generated";

    console.log("✅ [AI Analysis] Received response from OpenRouter");
    console.log(
      "📝 [AI Analysis] Response preview:",
      analysisText.substring(0, 200),
    );

    // Parse the AI response into structured sections
    const sections = parseAIResponse(analysisText);

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      sections,
      usage: aiResult.usage,
      model: aiResult.model,
    });
  } catch (error) {
    console.error("Error in AI analysis:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Parse AI response into structured sections
 */
function parseAIResponse(text: string) {
  const sections: any = {
    summary: "",
    insights: [],
    opportunities: [],
    risks: [],
    recommendations: [],
  };

  // Split by common section headers
  const summaryMatch = text.match(
    /(?:Executive Summary|Resumo Executivo)[:\n]+([\s\S]*?)(?=\n\n|\n#|Key Insights|Principais)/i,
  );
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim();
  }

  // Extract bullet points from each section
  const extractBullets = (sectionName: string) => {
    const regex = new RegExp(
      `${sectionName}[:\\n]+([\\s\\S]*?)(?=\\n\\n#|\\n\\d+\\.|$)`,
      "i",
    );
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1]
        .split("\n")
        .filter(
          (line) => line.trim().startsWith("-") || line.trim().startsWith("•"),
        )
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 0);
    }
    return [];
  };

  sections.insights = extractBullets("Key Insights|Principais Insights");
  sections.opportunities = extractBullets("Opportunities|Oportunidades");
  sections.risks = extractBullets("Risks|Riscos|Concerns|Preocupações");
  sections.recommendations = extractBullets(
    "Recommendations|Recomendações|Actions|Ações",
  );

  return sections;
}
