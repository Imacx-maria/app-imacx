import ProducaoClient from "@/components/producao/ProducaoClient";
import { createServerClient } from "@/utils/supabase";
import { cookies } from "next/headers";

export const revalidate = 0; // keep freshest data

async function getInitialData() {
  const supabase = await createServerClient(cookies());

  // fetch lightweight job summary (first page, default tab em_curso)
  const { data: jobs, error: jobsError } = await supabase
    .from("folhas_obras")
    .select(
      `id, numero_fo:Numero_do_, numero_orc, nome_campanha:Trabalho, cliente:Nome, data_in, data_saida, prioridade, concluido, data_concluido, notas`,
    )
    .not("numero_orc", "is", null)
    .eq("concluido", false)
    .order("prioridade", { ascending: false })
    .limit(25);

  // fetch reference data from PHC schema (same source as client-side)
  const { data: clientes, error: clientesError } = await supabase
    .schema("phc")
    .from("cl")
    .select("customer_id, customer_name")
    .order("customer_name", { ascending: true });

  // Fetch holidays with date filter (3-month window like client-side)
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const { data: holidays, error: holidaysError } = await supabase
    .from("feriados")
    .select("id, holiday_date, description")
    .gte("holiday_date", startDateStr)
    .lte("holiday_date", endDateStr)
    .order("holiday_date", { ascending: true });

  // Transform clientes to { value, label } format expected by ClienteOption
  const clienteOptions = (clientes || []).map(
    (c: { customer_id: number; customer_name: string }) => ({
      value: c.customer_id.toString(),
      label: c.customer_name,
    }),
  );

  return {
    jobs: jobs || [],
    clientes: clienteOptions,
    holidays: holidays || [],
    errors: {
      jobs: jobsError?.message || null,
      clientes: clientesError?.message || null,
      holidays: holidaysError?.message || null,
    },
  };
}

export default async function ProducaoPage() {
  const initial = await getInitialData();
  return (
    <ProducaoClient
      initialJobs={initial.jobs}
      initialClientes={initial.clientes}
      initialHolidays={initial.holidays}
      initialErrors={initial.errors}
    />
  );
}
