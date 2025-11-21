"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnaliseChartsProps {
  data: any;
}

export default function AnaliseCharts({ data }: AnaliseChartsProps) {
  const chartData = data
    ? Object.keys(data).map((key) => {
        const departmentData = data[key];
        const totalRevenue = departmentData.faturas.reduce(
          (acc: number, curr: any) => acc + curr.total_valor,
          0,
        );
        return {
          name: key,
          "Receita Total": totalRevenue,
        };
      })
    : [];

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Análise Departamentos
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Receita Total</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Receita Total" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Nº Faturas</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.keys(data).map((key) => ({
                  name: key,
                  "Nº Faturas": data[key].faturas.length,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Nº Faturas" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Nº Clientes</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.keys(data).map((key) => ({
                  name: key,
                  "Nº Clientes": data[key].clientes.clientes_ytd,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Nº Clientes" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Ticket Médio</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.keys(data).map((key) => {
                  const departmentData = data[key];
                  const totalRevenue = departmentData.faturas.reduce(
                    (acc: number, curr: any) => acc + curr.total_valor,
                    0,
                  );
                  const ticketMedio =
                    departmentData.faturas.length > 0
                      ? totalRevenue / departmentData.faturas.length
                      : 0;
                  return {
                    name: key,
                    "Ticket Médio": ticketMedio,
                  };
                })}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Ticket Médio" fill="#ff7300" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Orçamentos Qtd</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.keys(data).map((key) => ({
                  name: key,
                  "Orçamentos Qtd": data[key].orcamentos.length,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Orçamentos Qtd" fill="#387908" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="imx-border rounded-lg p-4">
          <h3 className="text-lg font-semibold">Taxa Conversão</h3>
          {data && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.keys(data).map((key) => {
                  const departmentData = data[key];
                  const conversionRate =
                    departmentData.orcamentos.length > 0
                      ? (departmentData.faturas.length /
                          departmentData.orcamentos.length) *
                        100
                      : 0;
                  return {
                    name: key,
                    "Taxa Conversão": conversionRate,
                  };
                })}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Taxa Conversão" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
