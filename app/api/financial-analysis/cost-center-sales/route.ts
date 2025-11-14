import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase";
import { createAdminClient } from "@/utils/supabaseAdmin";
import { cookies } from "next/headers";

const PERIOD_TO_RPC = {
  mtd: "get_cost_center_sales_mtd",
  ytd: "get_cost_center_sales_ytd",
} as const;

type PeriodKey = keyof typeof PERIOD_TO_RPC;

type CostCenterSalesRow = {
  centro_custo: string;
  vendas: number;
  var_pct: number;
  num_faturas: number;
  num_clientes: number;
  ticket_medio: number;
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authClient = await createServerClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = (searchParams.get("period") || "ytd")
      .toLowerCase()
      .trim() as PeriodKey;

    if (!Object.keys(PERIOD_TO_RPC).includes(periodParam)) {
      return NextResponse.json(
        { error: "Invalid period. Use 'mtd' or 'ytd'" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const rpcName = PERIOD_TO_RPC[periodParam];
    const { data, error } = await supabase.rpc(rpcName);

    if (error) {
      console.error("Cost center sales RPC error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch cost center sales data",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const rows = (data || []).map((row: CostCenterSalesRow) => ({
      centro_custo: row.centro_custo || "(Sem Centro de Custo)",
      vendas: Number(row.vendas) || 0,
      var_pct: Number(row.var_pct) || 0,
      num_faturas: Number(row.num_faturas) || 0,
      num_clientes: Number(row.num_clientes) || 0,
      ticket_medio: Number(row.ticket_medio) || 0,
    }));

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const currentStart =
      periodParam === "mtd"
        ? makeDateUTC(currentYear, currentMonth, 1)
        : makeDateUTC(currentYear, 0, 1);
    const today = makeDateUTC(currentYear, currentMonth, currentDay);

    let previousRange: { start: string; end: string } | null = null;
    if (periodParam === "ytd") {
      const previousYear = currentYear - 1;
      const prevEndDay = clampDay(previousYear, currentMonth, currentDay);
      previousRange = {
        start: formatDate(makeDateUTC(previousYear, 0, 1)),
        end: formatDate(makeDateUTC(previousYear, currentMonth, prevEndDay)),
      };
    }

    return NextResponse.json({
      costCenters: rows.sort(
        (a: CostCenterSalesRow, b: CostCenterSalesRow) => b.vendas - a.vendas,
      ),
      metadata: {
        period: periodParam,
        startDate: formatDate(currentStart),
        endDate: formatDate(today),
        previousStartDate: previousRange?.start ?? null,
        previousEndDate: previousRange?.end ?? null,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in cost-center-sales API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

const makeDateUTC = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day));

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const clampDay = (year: number, monthIndex: number, day: number) => {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
};
