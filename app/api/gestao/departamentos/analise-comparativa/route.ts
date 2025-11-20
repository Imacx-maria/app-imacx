import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/gestao/departamentos/analise-comparativa
 *
 * Returns department analysis data grouped by department
 * - Orçamentos by department and escalão (YTD)
 * - Faturas by department and escalão (YTD, linked via BI → BO)
 * - Conversion rates
 * - Customer metrics (YTD vs LYTD)
 *
 * Uses RPC functions:
 * - get_department_escaloes_orcamentos
 * - get_department_escaloes_faturas
 * - get_department_conversion_rates
 * - get_department_customer_metrics
 */
export async function GET(request: Request) {
  // Step 1: Validate authentication
  const cookieStore = cookies();
  const authClient = await createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "anual"; // 'mensal' or 'anual'

    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculate date ranges based on periodo
    let startDate: Date;
    let endDate: Date;
    let lytdStartDate: Date;
    let lytdEndDate: Date;

    if (periodo === "mensal") {
      // MTD: Month-to-Date
      startDate = new Date(currentYear, now.getMonth(), 1);
      endDate = now;
      // Previous Year Same Period
      lytdStartDate = new Date(currentYear - 1, now.getMonth(), 1);
      lytdEndDate = new Date(currentYear - 1, now.getMonth(), now.getDate());
    } else {
      // YTD: Year-to-Date
      startDate = new Date(currentYear, 0, 1);
      endDate = now;
      // Previous Year Same Period
      lytdStartDate = new Date(currentYear - 1, 0, 1);
      lytdEndDate = new Date(currentYear - 1, now.getMonth(), now.getDate());
    }

    const supabase = createAdminClient();

    // Department names to query
    const departments = ["Brindes", "Digital", "IMACX"];

    // Fetch data for all departments
    const results = await Promise.all(
      departments.map(async (dept) => {
        try {
          // 1. Escalões de Orçamentos
          const { data: orcamentosData, error: orcamentosError } =
            await supabase.rpc("get_department_escaloes_orcamentos", {
              departamento_nome: dept,
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0],
            });

          if (orcamentosError) {
            console.error(
              `Error fetching orcamentos for ${dept}:`,
              orcamentosError,
            );
          }

          // 2. Escalões de Faturas
          const { data: faturasData, error: faturasError } = await supabase.rpc(
            "get_department_escaloes_faturas",
            {
              departamento_nome: dept,
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0],
            },
          );

          if (faturasError) {
            console.error(`Error fetching faturas for ${dept}:`, faturasError);
          }

          // 3. Conversion Rates
          const { data: conversaoData, error: conversaoError } =
            await supabase.rpc("get_department_conversion_rates", {
              departamento_nome: dept,
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0],
            });

          if (conversaoError) {
            console.error(
              `Error fetching conversion rates for ${dept}:`,
              conversaoError,
            );
          }

          // 4. Customer Metrics
          const { data: clientesData, error: clientesError } =
            await supabase.rpc("get_department_customer_metrics", {
              departamento_nome: dept,
              ytd_start: startDate.toISOString().split("T")[0],
              ytd_end: endDate.toISOString().split("T")[0],
              lytd_start: lytdStartDate.toISOString().split("T")[0],
              lytd_end: lytdEndDate.toISOString().split("T")[0],
            });

          if (clientesError) {
            console.error(
              `Error fetching customer metrics for ${dept}:`,
              clientesError,
            );
          }

          return {
            departamento: dept,
            orcamentos: (orcamentosData || []).map((row: any) => ({
              departamento: dept,
              escaloes_valor: row.value_bracket,
              total_orcamentos: row.quote_count,
              total_valor: row.total_value,
              percentage: row.percentage,
            })),
            faturas: (faturasData || []).map((row: any) => ({
              departamento: dept,
              escaloes_valor: row.value_bracket,
              total_faturas: row.invoice_count,
              total_valor: row.total_value,
              percentage: row.percentage,
            })),
            conversao: (conversaoData || []).map((row: any) => ({
              departamento: dept,
              escalao: row.value_bracket,
              total_orcamentos: row.quote_count,
              total_faturas: row.invoice_count,
              taxa_conversao_pct: row.conversion_rate,
              total_valor_orcado: row.total_quoted_value,
              total_valor_faturado: row.total_invoiced_value,
            })),
            clientes:
              clientesData && clientesData.length > 0
                ? {
                    departamento: dept,
                    clientes_ytd: clientesData[0].customers_ytd,
                    clientes_lytd: clientesData[0].customers_lytd,
                    clientes_novos: clientesData[0].new_customers,
                    clientes_perdidos: clientesData[0].lost_customers,
                  }
                : {
                    departamento: dept,
                    clientes_ytd: 0,
                    clientes_lytd: 0,
                    clientes_novos: 0,
                    clientes_perdidos: 0,
                  },
          };
        } catch (error) {
          console.error(`Error fetching data for department ${dept}:`, error);
          return {
            departamento: dept,
            orcamentos: [],
            faturas: [],
            conversao: [],
            clientes: {
              departamento: dept,
              clientes_ytd: 0,
              clientes_lytd: 0,
              clientes_novos: 0,
              clientes_perdidos: 0,
            },
          };
        }
      }),
    );

    // Group results by department
    const groupedResults = results.reduce((acc, current) => {
      acc[current.departamento] = {
        orcamentos: current.orcamentos,
        faturas: current.faturas,
        conversao: current.conversao,
        clientes: current.clientes,
      };
      return acc;
    }, {} as any);

    return NextResponse.json({
      success: true,
      data: groupedResults,
      periodo,
      date_range: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        lytd_start: lytdStartDate.toISOString().split("T")[0],
        lytd_end: lytdEndDate.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("DEPARTAMENTOS ANALISE COMPARATIVA ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error: true,
        message: error instanceof Error ? error.message : "Unknown error",
        data: {},
      },
      { status: 500 },
    );
  }
}
