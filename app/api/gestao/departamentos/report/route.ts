import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Helper: Determine escalão based on value
function getEscalao(value: number): string {
  if (value < 1500) return "0-1500";
  if (value < 2500) return "1500-2500";
  if (value < 7500) return "2500-7500";
  if (value < 15000) return "7500-15000";
  if (value < 30000) return "15000-30000";
  return "30000+";
}

export async function GET(request: Request) {
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

    // Step 2: Query with admin client
    const supabase = createAdminClient();

    // Calcular datas para as queries
    const hoje = new Date();
    const currentYear = hoje.getFullYear();
    const ytdEndDate = hoje.toISOString().split("T")[0]; // YYYY-MM-DD

    // Query 1: Performance YTD por departamento
    const { data: performanceData, error: performanceError } =
      await supabase.rpc("get_department_performance_ytd", {
        current_year: currentYear,
        ytd_end_date: ytdEndDate,
      });

    if (performanceError) {
      console.error("Error fetching performance:", performanceError);
    }

    // Query 2: Rankings YTD
    const { data: rankingsData, error: rankingsError } = await supabase.rpc(
      "get_department_rankings_ytd",
    );

    if (rankingsError) {
      console.error("Error fetching rankings:", rankingsError);
    }

    // Query 3: Revenue mensal
    const startOfYear = new Date(currentYear, 0, 1).toISOString().split("T")[0];
    const { data: monthlyData, error: monthlyError } = await supabase.rpc(
      "get_department_monthly_revenue",
      {
        start_date: startOfYear,
        end_date: ytdEndDate,
      },
    );

    if (monthlyError) {
      console.error("Error fetching monthly revenue:", monthlyError);
    }

    // Query 4: Multi-year revenue (Cost Center)
    const { data: multiYearData, error: multiYearError } = await supabase.rpc(
      "get_cost_center_multi_year_ytd",
      {
        current_year: currentYear,
        current_month: hoje.getMonth() + 1,
        current_day: hoje.getDate(),
      },
    );

    if (multiYearError) {
      console.error("Error fetching multi-year revenue:", multiYearError);
    }

    // Query Top Customers YTD para o relatório
    let topCustomersData: any[] = [];
    try {
      const origin = new URL(request.url).origin;
      const topCustomersResponse = await fetch(
        `${origin}/api/financial-analysis/top-customers?limit=20&period=ytd`,
        {
          headers: {
            cookie: (request as any).headers?.get("cookie") ?? "",
          },
        },
      );

      if (topCustomersResponse.ok) {
        const topJson: any = await topCustomersResponse.json();
        const customers = Array.isArray(topJson?.customers)
          ? topJson.customers
          : [];

        topCustomersData = customers.map((c: any) => ({
          customer_id: c.customerId ?? c.customer_id,
          customer_name: c.customerName ?? c.customer_name,
          city: c.city,
          salesperson: c.salesperson,
          total_revenue: c.netRevenue ?? c.net_revenue ?? 0,
          invoice_count: c.invoiceCount ?? c.invoice_count ?? 0,
          previousNetRevenue:
            c.previousNetRevenue ?? c.previous_net_revenue ?? 0,
          previousDeltaPct: c.previousDeltaPct ?? c.previous_delta_pct ?? 0,
          revenueSharePct: c.revenueSharePct ?? c.revenue_share_pct ?? 0,
        }));
      } else {
        console.warn(
          "Top customers endpoint returned non-OK status:",
          topCustomersResponse.status,
        );
      }
    } catch (err) {
      console.error("Error fetching top customers for report:", err);
      topCustomersData = [];
    }

    // KPI data ainda não implementado
    const kpiData = null;

    // Query 7a: Cost Center Sales MTD
    const { data: costCenterSalesMTD, error: costCenterSalesMTDError } =
      await supabase.rpc("get_cost_center_sales_mtd");

    if (costCenterSalesMTDError) {
      console.error(
        "Error fetching cost center sales MTD:",
        costCenterSalesMTDError,
      );
    }

    // Query 7b: Cost Center Sales YTD
    const { data: costCenterSalesYTD, error: costCenterSalesYTDError } =
      await supabase.rpc("get_cost_center_sales_ytd");

    if (costCenterSalesYTDError) {
      console.error(
        "Error fetching cost center sales YTD:",
        costCenterSalesYTDError,
      );
    }

    // Combinar dados MTD + YTD
    const costCenterSalesData = (costCenterSalesYTD || []).map((ytd: any) => {
      const mtd = (costCenterSalesMTD || []).find(
        (m: any) => m.centro_custo === ytd.centro_custo,
      );
      return {
        cost_center_name: ytd.centro_custo,
        cost_center: ytd.centro_custo,
        mtd_current: mtd?.vendas || 0,
        ytd_current: ytd.vendas || 0,
        lytd: ytd.vendas / (1 + ytd.var_pct / 100) || 0, // Calcular LYTD reverso
        growth_rate: ytd.var_pct || 0,
        num_faturas: ytd.num_faturas || 0,
        num_clientes: ytd.num_clientes || 0,
        ticket_medio: ytd.ticket_medio || 0,
      };
    });

    // Query 8: Cost Center Top Customers YTD
    const {
      data: costCenterTopCustomersRaw,
      error: costCenterTopCustomersError,
    } = await supabase.rpc("get_cost_center_top_customers", {
      p_period: "ytd",
      p_limit: 20,
    });

    if (costCenterTopCustomersError) {
      console.error(
        "Error fetching cost center top customers:",
        costCenterTopCustomersError,
      );
    }

    // Agrupar top customers por centro de custo
    const costCenterTopCustomers = (costCenterTopCustomersRaw || []).reduce(
      (acc: any[], row: any) => {
        let center = acc.find((c) => c.cost_center === row.centro_custo);
        if (!center) {
          center = {
            cost_center: row.centro_custo,
            cost_center_name: row.centro_custo,
            costCenter: row.centro_custo,
            customers: [],
          };
          acc.push(center);
        }
        center.customers.push({
          rank: row.rank,
          client_name: row.customer_name,
          customer_name: row.customer_name,
          salesperson: row.salesperson,
          total_amount: row.net_revenue,
          total_revenue: row.net_revenue,
          invoice_count: row.invoice_count,
          quote_count: row.quote_count,
          conversion_rate: row.conversion_rate,
          revenue_share_pct: row.revenue_share_pct,
          last_invoice: row.last_invoice,
          days_since_last_invoice: row.days_since_last_invoice,
        });
        return acc;
      },
      [],
    );

    // Calculate YTD date range (same as page uses)
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0];
    const ytdEnd = now.toISOString().split("T")[0];

    // Query 5: Pipeline Brindes using RPC (same as page)
    const { data: pipelineBrindes, error: pipelineBrindesError } =
      await supabase.rpc("get_department_pipeline", {
        departamento_nome: "Brindes",
        start_date: ytdStart,
        end_date: ytdEnd,
      });

    if (pipelineBrindesError) {
      console.error("Error fetching pipeline Brindes:", pipelineBrindesError);
    }

    // Query 6: Pipeline Digital using RPC (same as page)
    const { data: pipelineDigital, error: pipelineDigitalError } =
      await supabase.rpc("get_department_pipeline", {
        departamento_nome: "Digital",
        start_date: ytdStart,
        end_date: ytdEnd,
      });

    if (pipelineDigitalError) {
      console.error("Error fetching pipeline Digital:", pipelineDigitalError);
    }

    // Query 7: Pipeline IMACX using RPC (same as page)
    const { data: pipelineImacx, error: pipelineImacxError } =
      await supabase.rpc("get_department_pipeline", {
        departamento_nome: "IMACX",
        start_date: ytdStart,
        end_date: ytdEnd,
      });

    if (pipelineImacxError) {
      console.error("Error fetching pipeline IMACX:", pipelineImacxError);
    }

    // Process pipeline data from RPC (already categorized)
    const processarPipeline = (data: any[], departamento: string) => {
      if (!data)
        return {
          top15: [],
          needsAttention: [],
          perdidos: [],
          aprovados: [],
        };

      // RPC returns data with quote_category field - split by category
      return {
        top15: data
          .filter((row) => row.quote_category === "top_15")
          .map((row) => ({
            orcamento_numero: row.quote_number,
            document_date: row.quote_date,
            cliente_nome: row.customer_name,
            total_value: row.quote_value,
            status: row.quote_status,
            departamento,
          })),

        needsAttention: data
          .filter((row) => row.quote_category === "needs_attention")
          .map((row) => ({
            orcamento_numero: row.quote_number,
            document_date: row.quote_date,
            cliente_nome: row.customer_name,
            total_value: row.quote_value,
            status: row.quote_status,
            departamento,
          })),

        perdidos: data
          .filter((row) => row.quote_category === "lost")
          .map((row) => ({
            orcamento_numero: row.quote_number,
            document_date: row.quote_date,
            cliente_nome: row.customer_name,
            total_value: row.quote_value,
            status: row.quote_status,
            motivo: row.quote_comments || "-",
            departamento,
          })),

        aprovados: data
          .filter((row) => row.quote_category === "approved")
          .map((row) => ({
            orcamento_numero: row.quote_number,
            document_date: row.quote_date,
            invoice_date: row.invoice_date,
            cliente_nome: row.customer_name,
            total_value: row.quote_value,
            status: row.quote_status,
            departamento,
          })),
      };
    };

    // Transformar dados de performance para formato do relatório
    const transformedData = (performanceData || []).map((dept: any) => ({
      departamento: dept.department_name,
      // Orçamentos
      total_orcamentos_ytd: dept.quotes_ytd || 0,
      total_orcamentos_lytd: dept.quotes_ytd_prev || 0,
      // Faturas
      total_faturas_ytd: dept.sales_ytd || 0,
      total_faturas_lytd: dept.sales_ytd_prev || 0,
      // Outros
      qtd_faturas_ytd: dept.invoices_ytd || 0,
      qtd_clientes_ytd: dept.customers_ytd || 0,
    }));

    // ============================================================================
    // FEATURE 1: Escalões Analysis (from analise API - same as page uses)
    // ============================================================================
    let escalaoAnalysis: any[] = [];
    try {
      const origin = new URL(request.url).origin;
      const analiseResponse = await fetch(
        `${origin}/api/gestao/departamentos/analise?periodo=anual`,
        {
          headers: {
            cookie: (request as any).headers?.get("cookie") ?? "",
          },
        },
      );

      if (analiseResponse.ok) {
        const analiseJson: any = await analiseResponse.json();
        const conversaoData = analiseJson.conversao || [];

        // Aggregate escalões across all departments
        const escalaoMap: any = {};
        conversaoData.forEach((item: any) => {
          const escalao = item.escalao;
          if (!escalaoMap[escalao]) {
            escalaoMap[escalao] = {
              escalao,
              total_quotes: 0,
              total_value: 0,
              approved: 0,
              pending: 0,
              lost: 0,
            };
          }
          escalaoMap[escalao].total_quotes += item.total_orcamentos || 0;
          escalaoMap[escalao].total_value += item.total_valor_orcado || 0;
          escalaoMap[escalao].approved += item.total_faturas || 0;
          // Pending/lost are not in conversion data, calculate from pipeline if needed
        });

        escalaoAnalysis = Object.values(escalaoMap);
      }
    } catch (err) {
      console.error("Error fetching escalões analysis:", err);
      escalaoAnalysis = [];
    }

    // ============================================================================
    // FEATURE 2: Salesperson Analysis (query all quotes with salesperson)
    // ============================================================================
    const { data: salespersonQuotes, error: salespersonError } = await supabase
      .schema("phc")
      .from("bo")
      .select(
        `
          document_id,
          document_number,
          document_date,
          total_value,
          customer_id,
          cl:customer_id (
            customer_name,
            salesperson
          )
        `,
      )
      .gte("document_date", ytdStart)
      .lte("document_date", ytdEnd)
      .eq("document_type", "Orçamento");

    if (salespersonError) {
      console.error("Error fetching salesperson quotes:", salespersonError);
    }

    // Get all converted quote IDs in one query (PERFORMANCE: bulk query instead of N queries)
    const quoteIds = (salespersonQuotes || []).map((q) => q.document_id);
    const { data: convertedQuoteIds } = await supabase
      .schema("phc")
      .from("bi")
      .select("document_id")
      .in("document_id", quoteIds);

    const convertedSet = new Set(
      (convertedQuoteIds || []).map((row: any) => row.document_id),
    );

    // Build salesperson analysis
    const salespersonAnalysis: any = {};

    for (const quote of salespersonQuotes || []) {
      const salesperson = (quote as any).cl?.salesperson || "(Sem Vendedor)";

      if (!salespersonAnalysis[salesperson]) {
        salespersonAnalysis[salesperson] = {
          salesperson,
          total_quotes: 0,
          total_value: 0,
          approved_quotes: 0,
          approved_value: 0,
          pending_quotes: 0,
          pending_value: 0,
          lost_quotes: 0,
          lost_value: 0,
          conversion_rate: 0,
          avg_quote_value: 0,
        };
      }

      const sp = salespersonAnalysis[salesperson];
      sp.total_quotes += 1;
      sp.total_value += quote.total_value || 0;

      // Check if converted (using pre-fetched set for performance)
      if (convertedSet.has(quote.document_id)) {
        // Has invoice
        sp.approved_quotes += 1;
        sp.approved_value += quote.total_value || 0;
      } else {
        // Check age to determine if pending or lost
        const daysOld =
          (now.getTime() - new Date(quote.document_date).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysOld > 60) {
          sp.lost_quotes += 1;
          sp.lost_value += quote.total_value || 0;
        } else {
          sp.pending_quotes += 1;
          sp.pending_value += quote.total_value || 0;
        }
      }
    }

    // Calculate conversion rates and averages
    Object.values(salespersonAnalysis).forEach((sp: any) => {
      sp.conversion_rate =
        sp.total_quotes > 0 ? (sp.approved_quotes / sp.total_quotes) * 100 : 0;
      sp.avg_quote_value =
        sp.total_quotes > 0 ? sp.total_value / sp.total_quotes : 0;
    });

    const salespersonList = Object.values(salespersonAnalysis).sort(
      (a: any, b: any) => (b.total_value || 0) - (a.total_value || 0),
    );

    // Format response
    const response = {
      success: true,
      generatedAt: new Date().toISOString(),
      currentYear: currentYear,

      // Dados de análise transformados
      orcamentos: transformedData.map((d: any) => ({
        departamento: d.departamento,
        total_orcamentos_ytd: d.total_orcamentos_ytd,
        total_orcamentos_lytd: d.total_orcamentos_lytd,
      })),

      faturas: transformedData.map((d: any) => ({
        departamento: d.departamento,
        total_faturas_ytd: d.total_faturas_ytd,
        total_faturas_lytd: d.total_faturas_lytd,
      })),

      conversao: transformedData.map((d: any) => ({
        departamento: d.departamento,
        taxa_conversao:
          d.total_orcamentos_ytd > 0
            ? d.total_faturas_ytd / d.total_orcamentos_ytd
            : 0,
      })),

      // Clientes: resumo simples de clientes ativos (somatório de customers_ytd)
      clientes: (() => {
        if (!Array.isArray(performanceData) || performanceData.length === 0) {
          return [];
        }
        const totalAtivos = performanceData.reduce(
          (sum: number, dept: any) => sum + (dept.customers_ytd || 0),
          0,
        );
        return [
          {
            tipo: "ytd",
            quantidade: totalAtivos,
          },
        ];
      })(),

      // Pipeline por departamento
      pipeline: {
        Brindes: processarPipeline(pipelineBrindes || [], "Brindes"),
        Digital: processarPipeline(pipelineDigital || [], "Digital"),
        IMACX: processarPipeline(pipelineImacx || [], "IMACX"),
      },

      // Totais calculados
      totais: {
        orcamentos: {
          ytd: transformedData.reduce(
            (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
            0,
          ),
          lytd: transformedData.reduce(
            (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
            0,
          ),
        },
        faturas: {
          ytd: transformedData.reduce(
            (sum: number, item: any) => sum + (item.total_faturas_ytd || 0),
            0,
          ),
          lytd: transformedData.reduce(
            (sum: number, item: any) => sum + (item.total_faturas_lytd || 0),
            0,
          ),
        },
      },

      // TODOS os dados adicionais
      kpi: kpiData || null,
      topCustomers: topCustomersData || [],
      multiYearRevenue: multiYearData || [],
      costCenterSales: costCenterSalesData || [],
      costCenterTopCustomers: costCenterTopCustomers || [],
      rankings: rankingsData || [],
      monthlyRevenue: monthlyData || [],

      // NEW: Escalões Analysis (Feature 1)
      escaloes: escalaoAnalysis,

      // NEW: Salesperson Analysis (Feature 2)
      salespersons: salespersonList,

      // Dados brutos para debug
      raw: {
        performance: performanceData,
        rankings: rankingsData,
        monthly: monthlyData,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in report route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
