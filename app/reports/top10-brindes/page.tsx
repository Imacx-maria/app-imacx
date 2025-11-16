"use client";

/**
 * REPORT: Top 10 Clientes - Departamento Brindes
 *
 * Usage:
 * 1. Open: http://localhost:3000/reports/top10-brindes
 * 2. Press Ctrl+P (or Cmd+P)
 * 3. Save as PDF
 * 4. Send to boss!
 */

import { ImacxTable, ImacxKpiCard } from "@/components/charts";
import { useEffect, useState } from "react";

export default function Top10BrindesReport() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetchBrindesCustomers();
  }, []);

  const fetchBrindesCustomers = async () => {
    try {
      setLoading(true);

      // Use your existing API endpoint
      const response = await fetch("/api/gestao/departamentos/analise");

      if (!response.ok) {
        throw new Error("Failed to fetch department data");
      }

      const data = await response.json();
      console.log("API Response:", data); // Debug

      // Extract Brindes department clients
      const brindesClients =
        data.clientes?.filter((c: any) => c.departamento === "Brindes") || [];
      console.log("Brindes clients found:", brindesClients.length); // Debug

      // Sort by total sales and get top 10
      const top10 = brindesClients
        .sort((a: any, b: any) => (b.total_ytd || 0) - (a.total_ytd || 0))
        .slice(0, 10)
        .map((c: any, idx: number) => ({
          ranking: idx + 1,
          no: c.cliente_no || "",
          cliente: c.cliente_nome || "N/A",
          total_vendas: c.total_ytd || 0,
          num_faturas: c.num_faturas_ytd || 0,
          ticket_medio:
            c.num_faturas_ytd > 0 ? (c.total_ytd || 0) / c.num_faturas_ytd : 0,
          primeira_fatura: c.primeira_fatura || new Date().toISOString(),
        }));

      // Calculate summary
      const totalVendas = top10.reduce(
        (sum: number, c: any) => sum + c.total_vendas,
        0,
      );
      const totalFaturas = top10.reduce(
        (sum: number, c: any) => sum + c.num_faturas,
        0,
      );

      setCustomers(top10);
      setSummary({
        totalVendas,
        totalFaturas,
        totalClientes: top10.length,
        ticketMedio: totalFaturas > 0 ? totalVendas / totalFaturas : 0,
      });
    } catch (error) {
      console.error("Error fetching Brindes customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Table columns definition
  const columns = [
    {
      key: "ranking",
      header: "#",
      align: "center" as const,
    },
    {
      key: "cliente",
      header: "Cliente",
    },
    {
      key: "no",
      header: "Código",
    },
    {
      key: "total_vendas",
      header: "Vendas YTD",
      align: "right" as const,
      format: (v: number) => formatCurrency(v),
    },
    {
      key: "num_faturas",
      header: "Faturas",
      align: "right" as const,
    },
    {
      key: "ticket_medio",
      header: "Ticket Médio",
      align: "right" as const,
      format: (v: number) => formatCurrency(v),
    },
    {
      key: "primeira_fatura",
      header: "Primeira Fatura",
      align: "center" as const,
      format: (v: string) => formatDate(v),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">A carregar dados...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">
          Top 10 Clientes - Departamento Brindes
        </h1>
        <p className="text-sm text-muted-foreground">
          Período: YTD {new Date().getFullYear()} • Gerado em{" "}
          {new Date().toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <ImacxKpiCard
          label="Total Vendas Top 10"
          value={summary ? formatCurrency(summary.totalVendas) : "€ 0"}
        />
        <ImacxKpiCard
          label="Total Faturas"
          value={summary?.totalFaturas || 0}
        />
        <ImacxKpiCard
          label="Clientes Top 10"
          value={summary?.totalClientes || 0}
        />
        <ImacxKpiCard
          label="Ticket Médio"
          value={summary ? formatCurrency(summary.ticketMedio) : "€ 0"}
        />
      </div>

      {/* Top 10 Table */}
      <div className="imx-border bg-card p-6">
        <h2 className="mb-4 text-lg">Ranking de Clientes - Brindes (YTD)</h2>
        {customers.length > 0 ? (
          <ImacxTable columns={columns} data={customers} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Sem dados disponíveis para o departamento Brindes.
            <br />
            <span className="text-sm">
              Verifique se existem faturas com departamento =
              &quot;Brindes&quot;
            </span>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-sm text-muted-foreground">
        <p className="mb-2">
          <strong>Notas:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Ranking baseado em vendas YTD (Year-to-Date)</li>
          <li>Valores não incluem faturas anuladas</li>
          <li>Departamento: Brindes</li>
          <li>Dados extraídos via API: /api/gestao/departamentos/analise</li>
        </ul>
      </div>

      {/* Print instructions (hidden when printing) */}
      <div className="mt-8 p-4 imx-border bg-accent no-print">
        <h3 className="text-sm mb-2">📄 Como gerar PDF:</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Pressione{" "}
            <kbd className="px-2 py-1 bg-background imx-border text-xs">
              Ctrl+P
            </kbd>{" "}
            (ou Cmd+P no Mac)
          </li>
          <li>Selecione &quot;Guardar como PDF&quot;</li>
          <li>Clique em &quot;Guardar&quot;</li>
          <li>Envie para o seu chefe! ✅</li>
        </ol>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .imx-border {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        kbd {
          display: inline-block;
          border-radius: 3px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
