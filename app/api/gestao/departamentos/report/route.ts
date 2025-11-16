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

    // Query 5: Pipeline Brindes (limit to recent data for performance)
    const { data: pipelineBrindes, error: pipelineBrindesError } =
      await supabase
        .from("vw_orcamentos_pipeline")
        .select("*")
        .eq("departamento", "Brindes")
        .gte(
          "document_date",
          new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
        )
        .order("total_value", { ascending: false })
        .limit(5000);

    if (pipelineBrindesError) {
      console.error("Error fetching pipeline Brindes:", pipelineBrindesError);
    }

    // Query 6: Pipeline Digital (limit to recent data for performance)
    const { data: pipelineDigital, error: pipelineDigitalError } =
      await supabase
        .from("vw_orcamentos_pipeline")
        .select("*")
        .eq("departamento", "Digital")
        .gte(
          "document_date",
          new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
        )
        .order("total_value", { ascending: false })
        .limit(5000);

    if (pipelineDigitalError) {
      console.error("Error fetching pipeline Digital:", pipelineDigitalError);
    }

    // Query 7: Pipeline IMACX (limit to recent data for performance)
    const { data: pipelineImacx, error: pipelineImacxError } = await supabase
      .from("vw_orcamentos_pipeline")
      .select("*")
      .eq("departamento", "IMACX")
      .gte(
        "document_date",
        new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
      )
      .order("total_value", { ascending: false })
      .limit(5000);

    if (pipelineImacxError) {
      console.error("Error fetching pipeline IMACX:", pipelineImacxError);
    }

    // Processar pipeline por categorias
    const processarPipeline = (data: any[], departamento: string) => {
      if (!data)
        return {
          top15: [],
          needsAttention: [],
          perdidos: [],
          aprovados: [],
        };

      const hoje = new Date();
      const dias14Atras = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
      const dias60Atras = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000);

      return {
        // Top 15: ALL pending/approved quotes sorted by value (not just current month)
        top15: data
          .filter((item) => {
            return item.status === "PENDENTE" || item.status === "APROVADO";
          })
          .sort((a: any, b: any) => (b.total_value || 0) - (a.total_value || 0))
          .slice(0, 15),

        needsAttention: data.filter((item) => {
          const dataDoc = new Date(item.document_date);
          return (
            item.status === "PENDENTE" &&
            item.total_value >= 7500 &&
            dataDoc <= dias14Atras
          );
        }),

        perdidos: data.filter((item) => {
          const dataDoc = new Date(item.document_date);
          return item.status === "PERDIDO" && dataDoc >= dias60Atras;
        }),

        aprovados: data.filter((item) => {
          const dataFatura = item.invoice_date
            ? new Date(item.invoice_date)
            : null;
          return (
            item.status === "APROVADO" &&
            dataFatura &&
            dataFatura >= dias60Atras
          );
        }),
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
    // FEATURE 1: Escalões Analysis (value ranges)
    // ============================================================================
    const escaloesByDept: any = {};
    const escaloes = [
      "0-1500",
      "1500-2500",
      "2500-7500",
      "7500-15000",
      "15000-30000",
      "30000+",
    ];

    // Analyze quotes by escalão
    const allPipeline = [
      ...(pipelineBrindes || []),
      ...(pipelineDigital || []),
      ...(pipelineImacx || []),
    ];
    const escalaoAnalysis = escaloes.map((escalao) => {
      const items = allPipeline.filter(
        (item) => getEscalao(item.total_value) === escalao,
      );
      return {
        escalao,
        total_quotes: items.length,
        total_value: items.reduce(
          (sum, item) => sum + (item.total_value || 0),
          0,
        ),
        approved: items.filter((item) => item.status === "APROVADO").length,
        pending: items.filter((item) => item.status === "PENDENTE").length,
        lost: items.filter((item) => item.status === "PERDIDO").length,
      };
    });

    // ============================================================================
    // FEATURE 2: Salesperson Analysis (effort, conversion, value mix)
    // ============================================================================
    const salespersonAnalysis: any = {};

    allPipeline.forEach((item) => {
      const salesperson = item.salesperson || "(Sem Vendedor)";
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
      sp.total_value += item.total_value || 0;

      if (item.status === "APROVADO") {
        sp.approved_quotes += 1;
        sp.approved_value += item.total_value || 0;
      } else if (item.status === "PENDENTE") {
        sp.pending_quotes += 1;
        sp.pending_value += item.total_value || 0;
      } else if (item.status === "PERDIDO") {
        sp.lost_quotes += 1;
        sp.lost_value += item.total_value || 0;
      }
    });

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
