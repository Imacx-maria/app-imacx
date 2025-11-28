import { useState, useCallback, useEffect, useMemo } from "react";
import { createBrowserClient } from "@/utils/supabase";
import {
  ArmazemOption,
  TransportadoraOption,
  Holiday,
  ClienteOption,
} from "../types";

export function useDashboardData() {
  const [armazens, setArmazens] = useState<ArmazemOption[]>([]);
  const [transportadoras, setTransportadoras] = useState<
    TransportadoraOption[]
  >([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);

  // Memoize supabase client to prevent re-creation on every render
  // This fixes infinite re-fetch loop caused by unstable dependency
  const supabase = useMemo(() => createBrowserClient(), []);

  const fetchHolidays = useCallback(async () => {
    try {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("feriados")
        .select("id, holiday_date, description")
        .gte("holiday_date", startDateStr)
        .lte("holiday_date", endDateStr)
        .order("holiday_date", { ascending: true });

      if (error) throw error;
      if (data) setHolidays(data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  }, [supabase]);

  const fetchArmazens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome_arm, morada, codigo_pos")
        .order("nome_arm");

      if (error) throw error;
      if (data) {
        setArmazens(
          data.map((a: any) => ({
            value: a.id,
            label: a.nome_arm,
            morada: a.morada,
            codigo_pos: a.codigo_pos,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching armazens:", error);
    }
  }, [supabase]);

  const fetchTransportadoras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("transportadora")
        .select("id, name")
        .order("name");

      if (error) throw error;
      if (data) {
        setTransportadoras(
          data.map((t: any) => ({
            value: t.id,
            label: t.name,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching transportadoras:", error);
    }
  }, [supabase]);

  const fetchClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_cl")
        .order("nome_cl");

      if (error) throw error;
      if (data) {
        setClientes(
          data.map((c: any) => ({
            value: c.id,
            label: c.nome_cl,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching clientes:", error);
    }
  }, [supabase]);

  useEffect(() => {
    Promise.all([
      fetchHolidays(),
      fetchArmazens(),
      fetchTransportadoras(),
      fetchClientes(),
    ]);
  }, [fetchHolidays, fetchArmazens, fetchTransportadoras, fetchClientes]);

  return {
    armazens,
    transportadoras,
    holidays,
    clientes,
    fetchArmazens,
    fetchTransportadoras,
    fetchHolidays,
    fetchClientes,
  };
}
