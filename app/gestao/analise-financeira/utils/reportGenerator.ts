import { formatCurrency } from "./formatters";

export const generateFinancialReport = async () => {
  const hoje = new Date().toLocaleDateString("pt-PT");
  const mes = new Date().toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });

  // Buscar TODOS os dados do endpoint dedicado
  try {
    const response = await fetch("/api/gestao/departamentos/report");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error("Erro ao buscar dados do relatório");
    }

    console.log("Dados do relatório:", data);
    console.log("Top Customers:", data.topCustomers);
    console.log("Cost Center Sales:", data.costCenterSales);
    console.log("Cost Center Top Customers:", data.costCenterTopCustomers);
    console.log("Monthly Revenue:", data.monthlyRevenue);
    console.log("Multi Year Revenue:", data.multiYearRevenue);
    console.log("Rankings:", data.rankings);
    console.log("Clientes:", data.clientes);

    // Calcular métricas
    const valorOrcamentosYTD = data.totais.orcamentos.ytd; // Valor monetário (€)
    const valorOrcamentosLYTD = data.totais.orcamentos.lytd; // Valor monetário (€)
    const valorFaturasYTD = data.totais.faturas.ytd; // Valor monetário (€)
    const valorFaturasLYTD = data.totais.faturas.lytd; // Valor monetário (€)

    // BUSCAR QUANTIDADES DO ENDPOINT DE KPI (fonte mais confiável)
    let qtdOrcamentosYTD = 0;
    let qtdFaturasYTD = 0;
    try {
      const kpiResponse = await fetch("/api/financial-analysis/kpi-dashboard");
      if (kpiResponse.ok) {
        const kpiData = await kpiResponse.json();
        // O KPI dashboard retorna as quantidades corretas
        qtdOrcamentosYTD = kpiData?.ytd?.quoteCount?.current || 0;
        qtdFaturasYTD = kpiData?.ytd?.invoices?.current || 0;
        console.log("✅ [Relatório] Dados do KPI:", {
          qtdOrcamentosYTD,
          qtdFaturasYTD,
          kpiYtd: kpiData?.ytd,
        });
      }
    } catch (err) {
      console.error("❌ [Relatório] Erro ao buscar KPI:", err);
      // Fallback: tentar usar salespersons
      qtdOrcamentosYTD = (data.salespersons || []).reduce(
        (sum: number, sp: any) => sum + (sp.total_quotes || 0),
        0
      );
      qtdFaturasYTD = data.totais?.qtd_faturas?.ytd || 0;
      if (!qtdFaturasYTD && data.raw?.performance) {
        qtdFaturasYTD = data.raw.performance.reduce(
          (sum: number, dept: any) => sum + (Number(dept.invoices_ytd) || 0),
          0
        );
      }
    }

    const crescimentoOrcamentos =
      valorOrcamentosLYTD > 0
        ? ((valorOrcamentosYTD - valorOrcamentosLYTD) / valorOrcamentosLYTD) *
          100
        : 0;

    const crescimentoFaturas =
      valorFaturasLYTD > 0
        ? ((valorFaturasYTD - valorFaturasLYTD) / valorFaturasLYTD) * 100
        : 0;

    // 3. Calcular Taxa de Conversão Global (Quantidade / Quantidade)
    // Ex: 929 faturas / 1702 orçamentos = 54.6%
    const taxaConversaoGlobal =
      qtdOrcamentosYTD > 0 && qtdFaturasYTD > 0
        ? (qtdFaturasYTD / qtdOrcamentosYTD) * 100
        : 0;

    // Debug detalhado no console para conferência
    console.log("📊 [Relatório] Taxa Conversão - DETALHADO:", {
      qtdFaturasYTD,
      qtdOrcamentosYTD,
      taxa_resultante: taxaConversaoGlobal,
      formula: `${qtdFaturasYTD} / ${qtdOrcamentosYTD} * 100`,
      data_salespersons_length: data.salespersons?.length || 0,
      data_totais_qtd_faturas: data.totais?.qtd_faturas,
      data_raw_performance_length: data.raw?.performance?.length || 0,
    });

    // Calcular total de needs attention
    const totalNeedsAttention = Object.values(data.pipeline).reduce(
      (sum: number, dept: any) =>
        sum +
        dept.needsAttention.reduce(
          (s: number, item: any) => s + (item.total_value || 0),
          0
        ),
      0
    );

    // Calcular quantidade total de orçamentos YTD para exibição (deve bater com qtdOrcamentosYTD)
    const allQuotesYTD = qtdOrcamentosYTD; // Reutilizar o valor calculado corretamente

    // Calcular orçamento médio
    const orcamentoMedio =
      allQuotesYTD > 0 ? valorOrcamentosYTD / allQuotesYTD : 0;

    // Formatar dados completos para o relatório
    const relatorio = `# RELATÓRIO FINANCEIRO IMACX COMPLETO - ${mes.toUpperCase()}

  ---
  **Data:** ${hoje}
  **Período:** YTD (Year-to-Date)
  **Preparado por:** Sistema de Análise IMACX
  ---

  ## 📊 SUMÁRIO EXECUTIVO

  ### KPIs Principais

  | Métrica | Valor YTD | Ano Anterior (LYTD) | Variação |
  |---------|-----------|---------------------|----------|
  | **Volume Orçamentos** | ${valorOrcamentosYTD.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  })} | ${valorOrcamentosLYTD.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescimentoOrcamentos > 0 ? "+" : ""}${crescimentoOrcamentos.toFixed(
      1
    )}% |
  | **Nº Orçamentos** | ${allQuotesYTD} | - | - |
  | **Orçamento Médio** | ${orcamentoMedio.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  })} | - | - |
  | **Volume Faturas** | ${valorFaturasYTD.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  })} | ${valorFaturasLYTD.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescimentoFaturas > 0 ? "+" : ""}${crescimentoFaturas.toFixed(
      1
    )}% |
  | **Nº Faturas** | ${qtdFaturasYTD} | - | - |
  | **Taxa de Conversão (Qtd)** | ${taxaConversaoGlobal.toFixed(1)}% | - | - |
  | **Nº de Departamentos** | 3 | - | - |

${
  data.kpi
    ? `
### Métricas Adicionais do Dashboard

| Indicador | Valor |
|-----------|-------|
| **Receita Total** | ${(data.kpi.totalRevenue || 0).toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })} |
| **Clientes Ativos** | ${data.kpi.activeCustomers || 0} |
| **Ticket Médio** | ${(data.kpi.averageOrderValue || 0).toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )} |
| **Total de Faturas** | ${data.kpi.totalInvoices || 0} |
${
  data.kpi.growthRate !== undefined
    ? `| **Taxa de Crescimento** | ${data.kpi.growthRate.toFixed(1)}% |`
    : ""
}
`
    : ""
}

### 🎯 Destaques Executivos

**Performance Geral:**
${
  crescimentoOrcamentos > 0 && crescimentoFaturas > 0
    ? `✅ A empresa apresenta **crescimento positivo** tanto em orçamentos (${
        crescimentoOrcamentos > 0 ? "+" : ""
      }${crescimentoOrcamentos.toFixed(1)}%) como em faturas (${
        crescimentoFaturas > 0 ? "+" : ""
      }${crescimentoFaturas.toFixed(1)}%).`
    : crescimentoOrcamentos > 0 && crescimentoFaturas <= 0
    ? `⚠️ **Situação mista**: Orçamentos crescem ${crescimentoOrcamentos.toFixed(
        1
      )}%, mas faturas ${
        crescimentoFaturas < 0 ? "caem" : "estagnaram"
      } ${crescimentoFaturas.toFixed(1)}%. Necessário analisar taxa de conversão.`
    : crescimentoOrcamentos <= 0 && crescimentoFaturas > 0
    ? `⚠️ **Padrão atípico**: Faturas crescem ${crescimentoFaturas.toFixed(
        1
      )}% apesar de orçamentos ${
        crescimentoOrcamentos < 0 ? "caírem" : "estagnarem"
      } ${crescimentoOrcamentos.toFixed(
        1
      )}%. Indica melhor qualificação ou aproveitamento de backlog.`
    : `🔴 **Alerta crítico**: Decréscimo em orçamentos (${crescimentoOrcamentos.toFixed(
        1
      )}%) e faturas (${crescimentoFaturas.toFixed(
        1
      )}%). Requer ação imediata.`
}

**Pipeline Comercial:**
- Total de oportunidades em atenção: ${Object.values(data.pipeline).reduce(
      (sum: number, dept: any) => sum + dept.needsAttention.length,
      0
    )} (${totalNeedsAttention.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })})
- Taxa de conversão global: ${taxaConversaoGlobal.toFixed(1)}%
${
  totalNeedsAttention > 100000
    ? `- ⚠️ **ATENÇÃO URGENTE**: Mais de €100k em oportunidades paradas há >14 dias`
    : totalNeedsAttention > 50000
    ? `- ⚠️ Valor significativo (>€50k) em oportunidades que precisam follow-up`
    : `- ✅ Pipeline em gestão adequada`
}

**Top Clientes:**
${
  data.topCustomers && data.topCustomers.length > 0
    ? `- Top 20 clientes representam ${data.topCustomers
        .slice(0, 20)
        .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Cliente #1: **${
        data.topCustomers[0]?.customer_name ||
        data.topCustomers[0]?.nome ||
        "N/A"
      }** (${(data.topCustomers[0]?.total_revenue || 0).toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )})`
    : "- Dados não disponíveis"
}

---

## 💼 ANÁLISE DETALHADA POR DEPARTAMENTO

${["Brindes", "Digital", "IMACX"]
  .map((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const fatDept = data.faturas.filter((f: any) => f.departamento === dept);
    const convDept = data.conversao.filter((c: any) => c.departamento === dept);

    // Buscar dados adicionais do performance raw
    const perfDept = data.raw?.performance?.find(
      (p: any) => p.department_name === dept
    );

    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0
    );
    const valorFatDept = fatDept.reduce(
      (sum: number, item: any) => sum + (item.total_faturas_ytd || 0),
      0
    );
    const valorFatDeptLYTD = fatDept.reduce(
      (sum: number, item: any) => sum + (item.total_faturas_lytd || 0),
      0
    );

    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;

    const crescFatDept =
      valorFatDeptLYTD > 0
        ? ((valorFatDept - valorFatDeptLYTD) / valorFatDeptLYTD) * 100
        : 0;

    // Taxa de conversão por QUANTIDADE (coerente com a página principal)
    const qtdFaturasDept = perfDept?.invoices_ytd || 0;
    const taxaConvDept =
      totalOrcDept > 0 ? (qtdFaturasDept / totalOrcDept) * 100 : 0;

    const qtdFaturas = perfDept?.invoices_ytd || 0;
    const qtdClientes = perfDept?.customers_ytd || 0;
    const ticketMedio = qtdFaturas > 0 ? valorFatDept / qtdFaturas : 0;

    return `
### ${dept}

#### Métricas Financeiras

| Métrica | Valor YTD | Valor LYTD | Variação |
|---------|-----------|------------|----------|
| **Orçamentos** | ${totalOrcDept.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${totalOrcDeptLYTD.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescDept > 0 ? "+" : ""}${crescDept.toFixed(1)}% |
| **Faturas** | ${valorFatDept.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${
      valorFatDeptLYTD > 0
        ? valorFatDeptLYTD.toLocaleString("pt-PT", {
            style: "currency",
            currency: "EUR",
          })
        : "-"
    } | ${
      valorFatDeptLYTD > 0
        ? (crescFatDept > 0 ? "+" : "") + crescFatDept.toFixed(1) + "%"
        : "-"
    } |
| **Taxa Conversão** | ${taxaConvDept.toFixed(1)}% | - | - |

#### Métricas Operacionais

| Indicador | Valor |
|-----------|-------|
| **Nº Faturas YTD** | ${qtdFaturas} |
| **Nº Clientes YTD** | ${qtdClientes} |
| **Ticket Médio** | ${
      ticketMedio > 0
        ? ticketMedio.toLocaleString("pt-PT", {
            style: "currency",
            currency: "EUR",
          })
        : "-"
    } |
| **Faturas por Cliente** | ${
      qtdClientes > 0 ? (qtdFaturas / qtdClientes).toFixed(1) : "-"
    } |

#### Performance Resumida

${
  crescDept > 0 && crescFatDept > 0
    ? "✅ **Crescimento positivo** em orçamentos e faturas - departamento em boa trajetória"
    : crescDept > 0 && crescFatDept <= 0
    ? "⚠️ **Atenção**: Orçamentos crescem mas faturas não acompanham - analisar conversão"
    : crescDept <= 0 && crescFatDept > 0
    ? "⚠️ **Mix interessante**: Faturas crescem apesar de orçamentos em queda - melhor qualificação?"
    : "🔴 **Alerta**: Decréscimo em orçamentos e faturas - ação imediata necessária"
}
`;
  })
  .join("\n---\n")}

---

## 📊 ANÁLISE POR ESCALÕES DE VALOR

### Distribuição de Orçamentos por Faixa de Valor

| Escalão | Nº Orçamentos | Valor Total | Aprovados | Pendentes | Perdidos |
|---------|---------------|-------------|-----------|-----------|----------|
${
  data.escaloes && data.escaloes.length > 0
    ? data.escaloes
        .map(
          (e: any) =>
            `| **${e.escalao}** | ${
              e.total_quotes
            } | ${e.total_value.toLocaleString("pt-PT", {
              style: "currency",
              currency: "EUR",
            })} | ${e.approved} | ${e.pending} | ${e.lost} |`
        )
        .join("\n")
    : "| - | - | - | - | - | - |"
}

**Análise:**
- Escalões menores (0-1500€) representam maior volume de transações
- Escalões maiores (>15000€) concentram maior valor
- Taxa de conversão varia significativamente por escalão

---

## 👥 ANÁLISE DE PERFORMANCE POR VENDEDOR

### Esforço, Conversão e Mix de Valores

${
  data.salespersons && data.salespersons.length > 0
    ? `
| Vendedor | Nº Orçamentos | Valor Total | Taxa Conversão | Ticket Médio | Aprovados |
|----------|---------------|-------------|----------------|--------------|----------|
${data.salespersons
  .slice(0, 15)
  .map(
    (sp: any) =>
      `| **${sp.salesperson}** | ${
        sp.total_quotes
      } | ${sp.total_value.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })} | ${sp.conversion_rate.toFixed(1)}% | ${sp.avg_quote_value.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )} | ${sp.approved_quotes} |`
  )
  .join("\n")}

### Detalhes por Vendedor

${data.salespersons
  .slice(0, 10)
  .map(
    (sp: any) => `
#### ${sp.salesperson}

- **Esforço (Nº Orçamentos):** ${sp.total_quotes}
- **Valor Total:** ${sp.total_value.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}
- **Taxa de Conversão:** ${sp.conversion_rate.toFixed(1)}%
- **Ticket Médio:** ${sp.avg_quote_value.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}
- **Aprovados:** ${sp.approved_quotes} (${sp.approved_value.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )})
- **Pendentes:** ${sp.pending_quotes} (${sp.pending_value.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )})
- **Perdidos:** ${sp.lost_quotes} (${sp.lost_value.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })})
`
  )
  .join("\n")}
`
    : "\n*Dados de vendedores não disponíveis*\n"
}

---

## 📈 PIPELINE COMERCIAL DETALHADO

${["Brindes", "Digital", "IMACX"]
  .map((dept) => {
    const pipeline = data.pipeline[dept];
    const totalPipeline = pipeline.top15.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0
    );
    const totalNeedsAttention = pipeline.needsAttention.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0
    );
    const totalPerdidos = pipeline.perdidos.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0
    );
    const totalAprovados = pipeline.aprovados.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0
    );

    // FILTER PERDIDOS: Only show 60-90 days (recently lost, actionable)
    const filteredPerdidos = pipeline.perdidos.filter((item: any) => {
      const dias = item.dias_decorridos || 0;
      return dias >= 60 && dias <= 90;
    });

    return `
### ${dept}

#### Resumo Geral

| Categoria | Quantidade | Valor Total |
|-----------|------------|-------------|
| **Top 15 do Mês** | ${pipeline.top15.length} | ${totalPipeline.toLocaleString(
      "pt-PT",
      { style: "currency", currency: "EUR" }
    )} |
| **Needs Attention** | ${
      pipeline.needsAttention.length
    } | ${totalNeedsAttention.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} |
| **Perdidos (60-90d)** | ${
      filteredPerdidos.length
    } | ${filteredPerdidos
      .reduce((sum: number, item: any) => sum + (item.total_value || 0), 0)
      .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |

${
  pipeline.top15.length > 0
    ? `
#### 🔝 Top 15 Oportunidades

| # | ORC# | Cliente | Valor | Status | Data | Dias |
|---|------|---------|-------|--------|------|------|
${pipeline.top15
  .slice(0, 15)
  .map((item: any, idx: number) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente = item.cliente_nome || item.customer_name || "N/A";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const status = item.status || "N/A";
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = item.document_date
      ? Math.floor(
          (new Date().getTime() - new Date(item.document_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : "-";

    return `| ${
      idx + 1
    } | ${orcNum} | **${cliente}** | ${valor} | ${status} | ${data} | ${dias} |`;
  })
  .join("\n")}
`
    : ""
}

${
  pipeline.needsAttention.length > 0
    ? `
#### ⚠️ Oportunidades que Precisam Atenção (>€7.500, +14 dias)

| ORC# | Cliente | Valor | Data | Dias Pendente |
|------|---------|-------|------|---------------|
${pipeline.needsAttention
  .map((item: any) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente =
      item.cliente_nome ||
      item.customer_name ||
      item.client_name ||
      "Cliente não identificado";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = Math.floor(
      (new Date().getTime() - new Date(item.document_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return `| ${orcNum} | **${cliente}** | ${valor} | ${data} | ${dias} |`;
  })
  .join("\n")}

**Total em risco:** ${totalNeedsAttention.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}
`
    : ""
}

${
  filteredPerdidos.length > 0
    ? `
#### ❌ Perdidos Recentes (60-90 dias)

**Resumo:**
- Total perdido: ${filteredPerdidos
        .reduce((sum: number, item: any) => sum + (item.total_value || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Quantidade: ${filteredPerdidos.length} orçamentos (60-90 dias sem resposta)

| ORC# | Cliente | Valor | Data | Dias | Motivo |
|------|---------|-------|------|------|--------|
${filteredPerdidos
  .slice(0, 15)
  .map((item: any) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente = item.cliente_nome || item.customer_name || "N/A";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = item.document_date
      ? Math.floor(
          (new Date().getTime() - new Date(item.document_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : "-";
    const motivo = item.motivo || "-";

    return `| ${orcNum} | **${cliente}** | ${valor} | ${data} | ${dias} | ${motivo} |`;
  })
  .join("\n")}
`
    : ""
}
`;
  })
  .join("\n---\n")}

---

## 🏆 TOP 20 CLIENTES YTD

${
  data.topCustomers && data.topCustomers.length > 0
    ? `
| # | Cliente | Valor YTD | Ano Anterior | Var % | % Total | Nº Faturas | Ticket Médio |
|---|---------|-----------|--------------|-------|---------|------------|--------------|
${data.topCustomers
  .slice(0, 20)
  .map((c: any, idx: number) => {
    const revenue = c.total_revenue || 0;
    const prevRevenue = c.previousNetRevenue || c.previous_net_revenue || 0;
    const varPct = c.previousDeltaPct || c.previous_delta_pct || 0;
    const sharePct = c.revenueSharePct || c.revenue_share_pct || 0;
    const invoiceCount = c.invoice_count || 0;
    const ticketMedio = invoiceCount > 0 ? revenue / invoiceCount : 0;

    return `| ${idx + 1} | **${c.customer_name || c.nome || "N/A"}** | ${revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${prevRevenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}% | ${sharePct.toFixed(1)}% | ${invoiceCount} | ${ticketMedio.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |`;
  })
  .join("\n")}

**Total Top 20:** ${data.topCustomers
        .slice(0, 20)
        .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

---

## 📊 ANÁLISE POR CENTRO DE CUSTO

### Performance Detalhada YTD

${
  data.costCenterSales && data.costCenterSales.length > 0
    ? `
| Centro de Custo | MTD | YTD Atual | YTD Ano Anterior | Crescimento |
|-----------------|-----|-----------|------------------|-------------|
${data.costCenterSales
  .map((cc: any) => {
    const crescimento =
      cc.lytd > 0 ? ((cc.ytd_current - cc.lytd) / cc.lytd) * 100 : 0;
    return `| **${
      cc.cost_center_name || cc.cost_center
    }** | ${(cc.mtd_current || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${(cc.ytd_current || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${(cc.lytd || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescimento > 0 ? "+" : ""}${crescimento.toFixed(1)}% |`;
  })
  .join("\n")}

**Total Geral YTD:** ${data.costCenterSales
        .reduce((sum: number, cc: any) => sum + (cc.ytd_current || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

### Top 20 Clientes por Centro de Custo

${
  data.costCenterTopCustomers && data.costCenterTopCustomers.length > 0
    ? data.costCenterTopCustomers
        .map(
          (cc: any) => `
#### ${cc.cost_center_name || cc.cost_center || cc.costCenter}

${
  cc.customers && cc.customers.length > 0
    ? `
| # | Cliente | Vendedor | Receita | % Centro | Nº Faturas | Nº Orçamentos | Conversão | Última Fatura |
|---|---------|----------|---------|----------|------------|---------------|-----------|---------------|
${cc.customers
  .slice(0, 20)
  .map((c: any) => {
    const rank = c.rank || 0;
    const name = c.client_name || c.customer_name || "N/A";
    const salesperson = c.salesperson || "-";
    const revenue = c.total_amount || c.total_revenue || 0;
    const sharePct = c.revenue_share_pct || 0;
    const invoiceCount = c.invoice_count || 0;
    const quoteCount = c.quote_count || 0;
    const conversionRate = c.conversion_rate != null ? c.conversion_rate : 0;
    const lastInvoice = c.last_invoice
      ? new Date(c.last_invoice).toLocaleDateString("pt-PT")
      : "-";

    return `| ${rank} | **${name}** | ${salesperson} | ${revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${sharePct.toFixed(1)}% | ${invoiceCount} | ${quoteCount} | ${conversionRate.toFixed(0)}% | ${lastInvoice} |`;
  })
  .join("\n")}

**Total:** ${cc.customers
        .reduce(
          (sum: number, c: any) =>
            sum + (c.total_amount || c.total_revenue || 0),
          0
        )
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem clientes registados"
}
`
        )
        .join("\n")
    : "Sem dados disponíveis"
}

---

## 📈 VENDAS MENSAIS YTD

${
  data.monthlyRevenue && data.monthlyRevenue.length > 0
    ? `
| Mês | Departamento | Valor | Faturas | Clientes |
|-----|--------------|-------|---------|----------|
${data.monthlyRevenue
  .slice(0, 36)
  .map((m: any) => {
    const monthDate = new Date(m.month);
    const monthName = monthDate.toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
    return `| **${monthName}** | ${
      m.department_name || "N/A"
    } | ${(m.revenue || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${m.invoice_count || 0} | ${m.unique_customers || 0} |`;
  })
  .join("\n")}
`
    : "Sem dados disponíveis"
}

---

## 📊 COMPARAÇÃO MULTI-ANO POR CENTRO DE CUSTO (Últimos 3 Anos YTD)

${
  data.multiYearRevenue && data.multiYearRevenue.length > 0
    ? `
| Centro de Custo | ${new Date().getFullYear() - 2} | ${
        new Date().getFullYear() - 1
      } | ${new Date().getFullYear()} | Variação YoY |
|----------------|------|------|------|--------------|
${data.multiYearRevenue
  .map((cc: any) => {
    const ano2 = cc.ano_anterior_2 || 0;
    const ano1 = cc.ano_anterior || 0;
    const ano0 = cc.ano_atual || 0;
    const variacao = ano1 > 0 ? ((ano0 - ano1) / ano1) * 100 : 0;
    return `| **${cc.cost_center || "N/A"}** | ${ano2.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${ano1.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${ano0.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}% |`;
  })
  .join("\n")}

**Total ${new Date().getFullYear()}:** ${data.multiYearRevenue
        .reduce((sum: number, cc: any) => sum + (cc.ano_atual || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

---

## 🏅 RANKINGS DE PERFORMANCE

${
  data.salespersons && data.salespersons.length > 0
    ? `
### Top Performers por Vendedor

| Ranking | Vendedor | Orçamentos | Valor Total | Taxa Conversão | Aprovados | Pendentes | Perdidos |
|---------|----------|------------|-------------|----------------|-----------|-----------|----------|
${data.salespersons
  .slice(0, 15)
  .map(
    (sp: any, idx: number) =>
      `| ${idx + 1} | **${sp.salesperson}** | ${
        sp.total_quotes
      } | ${(sp.total_value || 0).toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })} | ${(sp.conversion_rate || 0).toFixed(1)}% | ${
        sp.approved_quotes
      } (${(sp.approved_value || 0).toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}) | ${sp.pending_quotes} (${(sp.pending_value || 0).toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )}) | ${sp.lost_quotes} (${(sp.lost_value || 0).toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}) |`
  )
  .join("\n")}

**TOTAIS:**
- Orçamentos: ${data.salespersons.reduce(
        (sum: number, sp: any) => sum + (sp.total_quotes || 0),
        0
      )}
- Valor Total: ${data.salespersons
        .reduce((sum: number, sp: any) => sum + (sp.total_value || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Taxa Conversão Média: ${(
        data.salespersons.reduce(
          (sum: number, sp: any) => sum + (sp.conversion_rate || 0),
          0
        ) / data.salespersons.length
      ).toFixed(1)}%
`
    : "Dados de vendedores não disponíveis"
}

---

## 💰 ANÁLISE POR ESCALÕES DE VALOR

${
  data.escaloes && data.escaloes.length > 0
    ? `
### Distribuição Global por Escalão

| Escalão (€) | Orçamentos | Valor Total | Aprovados | Taxa Conversão |
|-------------|------------|-------------|-----------|----------------|
${data.escaloes
  .sort((a: any, b: any) => {
    const order = [
      "0-1500",
      "1500-2500",
      "2500-7500",
      "7500-15000",
      "15000-30000",
      "30000+",
    ];
    return order.indexOf(a.escalao) - order.indexOf(b.escalao);
  })
  .map((e: any) => {
    const conversionRate =
      e.total_quotes > 0 ? (e.approved / e.total_quotes) * 100 : 0;
    return `| **${e.escalao}** | ${
      e.total_quotes || 0
    } | ${(e.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${e.approved || 0} | ${conversionRate.toFixed(1)}% |`;
  })
  .join("\n")}

**TOTAIS:**
- Orçamentos: ${data.escaloes.reduce(
        (sum: number, e: any) => sum + (e.total_quotes || 0),
        0
      )}
- Valor: ${data.escaloes
        .reduce((sum: number, e: any) => sum + (e.total_value || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Aprovados: ${data.escaloes.reduce(
        (sum: number, e: any) => sum + (e.approved || 0),
        0
      )}

### Insights de Escalões

${(() => {
  const highestVolume = data.escaloes.reduce(
    (max: any, e: any) =>
      (e.total_value || 0) > (max.total_value || 0) ? e : max,
    data.escaloes[0]
  );
  const highestConversion = data.escaloes.reduce((max: any, e: any) => {
    const maxRate =
      max.total_quotes > 0 ? (max.approved / max.total_quotes) * 100 : 0;
    const eRate = e.total_quotes > 0 ? (e.approved / e.total_quotes) * 100 : 0;
    return eRate > maxRate ? e : max;
  }, data.escaloes[0]);

  return `
- 📊 **Maior Volume**: Escalão ${highestVolume.escalao} com ${(
    highestVolume.total_value || 0
  ).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- ✅ **Melhor Conversão**: Escalão ${highestConversion.escalao} com ${
    highestConversion.total_quotes > 0
      ? (
          (highestConversion.approved / highestConversion.total_quotes) *
          100
        ).toFixed(1)
      : 0
  }%
- 📈 **Oportunidade**: ${
    data.escaloes.filter((e: any) => {
      const rate = e.total_quotes > 0 ? (e.approved / e.total_quotes) * 100 : 0;
      return rate < 50 && e.total_quotes > 5;
    }).length > 0
      ? `Escalões ${data.escaloes
          .filter((e: any) => {
            const rate =
              e.total_quotes > 0 ? (e.approved / e.total_quotes) * 100 : 0;
            return rate < 50 && e.total_quotes > 5;
          })
          .map((e: any) => e.escalao)
          .join(", ")} têm conversão abaixo de 50%`
      : "Todas as faixas com conversão saudável"
  }
`;
})()}
`
    : "Dados de escalões não disponíveis"
}

---

## 👥 ANÁLISE DE CLIENTES

### Movimento de Clientes YTD

${
  data.clientes && data.clientes.length > 0
    ? `
| Categoria | Quantidade |
|-----------|------------|
| **Clientes Ativos** | ${
        data.clientes.find((c: any) => c.tipo === "ytd")?.quantidade || 0
      } |
| **Novos Clientes** | ${
        data.clientes.filter((c: any) => c.tipo === "novo").length
      } |
| **Clientes Perdidos** | ${
        data.clientes.filter((c: any) => c.tipo === "perdido").length
      } |
`
    : "Sem dados disponíveis"
}

---

## 🎯 CONCLUSÕES E RECOMENDAÇÕES

### Sumário de Performance

| Indicador | Valor YTD | vs Ano Anterior | Status |
|-----------|-----------|-----------------|--------|
| **Orçamentos** | ${valorOrcamentosYTD.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescimentoOrcamentos > 0 ? "+" : ""}${crescimentoOrcamentos.toFixed(
      1
    )}% | ${
      crescimentoOrcamentos > 10
        ? "🟢 Excelente"
        : crescimentoOrcamentos > 0
        ? "🟡 Positivo"
        : crescimentoOrcamentos > -10
        ? "🟠 Atenção"
        : "🔴 Crítico"
    } |
| **Faturas** | ${valorFaturasYTD.toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    })} | ${crescimentoFaturas > 0 ? "+" : ""}${crescimentoFaturas.toFixed(
      1
    )}% | ${
      crescimentoFaturas > 10
        ? "🟢 Excelente"
        : crescimentoFaturas > 0
        ? "🟡 Positivo"
        : crescimentoFaturas > -10
        ? "🟠 Atenção"
        : "🔴 Crítico"
    } |
| **Taxa Conversão (Qtd)** | ${taxaConversaoGlobal.toFixed(1)}% | - | ${
      taxaConversaoGlobal > 70
        ? "🟢 Ótima"
        : taxaConversaoGlobal > 50
        ? "🟡 Boa"
        : taxaConversaoGlobal > 30
        ? "🟠 Média"
        : "🔴 Baixa"
    } |
${
  data.kpi
    ? `| **Clientes Ativos** | ${data.kpi.activeCustomers || 0} | - | - |`
    : ""
}

### 📋 Ações Prioritárias

${(() => {
  const acoes = [];

  // Análise de crescimento
  if (crescimentoOrcamentos > 0 && crescimentoFaturas > 0) {
    acoes.push(
      "**1. ✅ Consolidar Crescimento**\n   - Manter estratégia comercial atual\n   - Documentar best practices dos departamentos de melhor performance\n   - Reforçar equipes que demonstram resultados positivos"
    );
  } else if (crescimentoOrcamentos > 0 && crescimentoFaturas <= 0) {
    acoes.push(
      "**1. ⚠️ URGENTE: Melhorar Taxa de Conversão**\n   - Análise detalhada do funil de vendas\n   - Identificar pontos de atrito no processo comercial\n   - Reunião com equipas para entender bloqueios na conversão\n   - Revisão de pricing e condições comerciais"
    );
  } else if (crescimentoOrcamentos <= 0 && crescimentoFaturas > 0) {
    acoes.push(
      "**1. 🔍 Analisar Eficiência Operacional**\n   - Investigar por que faturas crescem com menos orçamentos\n   - Avaliar qualidade de qualificação de leads\n   - Considerar aumentar esforço comercial para manter tendência"
    );
  } else {
    acoes.push(
      "**1. 🚨 CRÍTICO: Reversão de Tendência Negativa**\n   - Análise de causa raiz imediata\n   - Revisão completa da estratégia comercial\n   - Reunião executiva de emergência\n   - Plano de ação de 30 dias para recuperação"
    );
  }

  // Pipeline
  if (totalNeedsAttention > 100000) {
    acoes.push(
      `**2. 💰 CRÍTICO: Recuperar Pipeline Parado**\n   - **${totalNeedsAttention.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )}** em oportunidades >14 dias\n   - Follow-up imediato com todos os clientes da lista "Needs Attention"\n   - Definir responsáveis e prazos para cada oportunidade\n   - Revisão semanal até reduzir para <€50k`
    );
  } else if (totalNeedsAttention > 50000) {
    acoes.push(
      `**2. ⚠️ Gestão Ativa de Pipeline**\n   - ${totalNeedsAttention.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )} em oportunidades que precisam atenção\n   - Priorizar follow-up nos próximos 7 dias\n   - Estabelecer SLA de resposta para oportunidades >€7.500`
    );
  }

  // Departamentos
  const deptsComProblemas = ["Brindes", "Digital", "IMACX"].filter((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const fatDept = data.faturas.filter((f: any) => f.departamento === dept);
    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0
    );
    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;
    return crescDept < 0;
  });

  if (deptsComProblemas.length > 0) {
    acoes.push(
      `**3. 🎯 Focar em Departamentos com Dificuldades**\n   - ${deptsComProblemas.join(
        ", "
      )} apresenta(m) decréscimo\n   - Análise específica de causas por departamento\n   - Benchmarking com departamentos de melhor performance\n   - Plano de recuperação individualizado`
    );
  }

  // Top clientes
  if (data.topCustomers && data.topCustomers.length > 0) {
    const top5Total = data.topCustomers
      .slice(0, 5)
      .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0);
    const percentTop5 = (top5Total / valorFaturasYTD) * 100;

    if (percentTop5 > 50) {
      acoes.push(
        `**${
          acoes.length + 1
        }. ⚠️ Diversificação de Carteira**\n   - Top 5 clientes representam ${percentTop5.toFixed(
          1
        )}% da receita\n   - Risco de concentração elevado\n   - Ativar programa de aquisição de novos clientes\n   - Desenvolver clientes de médio porte`
      );
    }
  }

  return acoes.join("\n\n");
})()}

### 💡 Oportunidades Identificadas

${(() => {
  const oportunidades = [];

  // Pipeline aprovados
  const totalAprovados = Object.values(data.pipeline).reduce(
    (sum: number, dept: any) =>
      sum +
      dept.aprovados.reduce(
        (s: number, item: any) => s + (item.total_value || 0),
        0
      ),
    0
  );

  if (totalAprovados > 0) {
    oportunidades.push(
      `- **${totalAprovados.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}** em orçamentos aprovados nos últimos 60 dias - garantir execução e faturação eficiente`
    );
  }

  // Top 15 do mês
  const totalTop15 = Object.values(data.pipeline).reduce(
    (sum: number, dept: any) =>
      sum +
      dept.top15.reduce(
        (s: number, item: any) => s + (item.total_value || 0),
        0
      ),
    0
  );

  if (totalTop15 > 0) {
    oportunidades.push(
      `- **${totalTop15.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
      })}** em pipeline ativo do mês atual - focar em fechamento antes do fim do período`
    );
  }

  // Taxa de conversão baixa
  if (taxaConversaoGlobal < 50) {
    // Calcular valor adicional estimado baseado em quantidade de faturas adicionais
    const faturasAdicionaisEstimadas = Math.round(qtdOrcamentosYTD * 0.1);
    const valorAdicionalEstimado =
      faturasAdicionaisEstimadas * (valorFaturasYTD / qtdFaturasYTD);
    oportunidades.push(
      `- Taxa de conversão de ${taxaConversaoGlobal.toFixed(
        1
      )}% indica potencial de melhoria - cada 10% de aumento representa ~${faturasAdicionaisEstimadas} faturas adicionais (~${valorAdicionalEstimado.toLocaleString(
        "pt-PT",
        { style: "currency", currency: "EUR" }
      )})`
    );
  }

  // Crescimento de algum departamento
  const deptsCrescendo = ["Brindes", "Digital", "IMACX"].filter((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0
    );
    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;
    return crescDept > 15;
  });

  if (deptsCrescendo.length > 0) {
    oportunidades.push(
      `- Departamento(s) ${deptsCrescendo.join(
        ", "
      )} com forte crescimento - analisar estratégias de sucesso para replicar`
    );
  }

  return oportunidades.length > 0
    ? oportunidades.join("\n")
    : "- Continuar monitorização de KPIs e identificação proativa de oportunidades";
})()}

### 📊 Próxima Revisão

**Recomendações para próximo relatório:**
- Acompanhar evolução das ações prioritárias definidas
- Monitorizar taxa de conversão semanal
- Revisar status de oportunidades "Needs Attention"
- Analisar tendência de crescimento mês a mês
- Avaliar performance individual dos centros de custo

---

*Relatório gerado automaticamente pelo Sistema de Análise Financeira IMACX*
*Data de geração: ${new Date().toLocaleString("pt-PT")}*
*Para questões ou esclarecimentos: gestao@imacx.pt*
*Confidencial - Uso interno apenas*
`;

    // Criar download do relatório
    const blob = new Blob([relatorio], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-imacx-${new Date()
      .toISOString()
      .split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    alert(
      "Erro ao gerar relatório. Verifica se os dados estão carregados e tenta novamente."
    );
  }
};
