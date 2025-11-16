---
name: analise-financeira-imacx
description: Gera relatório financeiro mensal completo com análise de performance, rankings e insights estratégicos
version: 2.0.0
---

# Análise Financeira IMACX - Relatório Mensal

## Objetivo

Gerar relatório financeiro mensal executivo para apresentação à gestão, incluindo:
- Análise de performance por departamento (Brindes, Digital, IMACX)
- Rankings e comparações YTD vs LYTD
- Pipeline comercial detalhado
- Top clientes e análise por centro de custo
- Métricas mensais e multi-ano
- Insights e recomendações estratégicas

## Como Usar

1. **Ativar a skill:**
   ```
   /skill analise-financeira-imacx
   ```

2. **A skill irá:**
   - Buscar dados do endpoint `/api/gestao/departamentos/report`
   - Analisar performance de todos os departamentos
   - Gerar relatório completo em Markdown
   - Salvar em `TEMP/docs/relatorio_financeiro_[MES]_[ANO].md`

## Instruções de Execução

### 1. COLETA DE DADOS

Primeiro, obtenha os dados da API:

```bash
cd "C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean"

# Salvar dados da API
curl -s http://localhost:3000/api/gestao/departamentos/report > C:\Users\maria\analise_data.json
```

**Nota:** Se o curl falhar (erro de autenticação), instrua o usuário a:
1. Ir até http://localhost:3000/gestao/analise-financeira
2. Abrir DevTools (F12) > Console
3. Executar: `fetch('/api/gestao/departamentos/report').then(r => r.json()).then(d => console.log(JSON.stringify(d)))`
4. Copiar o JSON resultante

### 2. ESTRUTURA DOS DADOS

O endpoint retorna todos os dados necessários:

```typescript
{
  success: boolean;
  generatedAt: string;
  currentYear: number;

  // Performance por departamento
  orcamentos: Array<{departamento, total_orcamentos_ytd, total_orcamentos_lytd}>;
  faturas: Array<{departamento, total_faturas_ytd, total_faturas_lytd}>;
  conversao: Array<{departamento, taxa_conversao}>;

  // Pipeline comercial por departamento
  pipeline: {
    Brindes: {top15, needsAttention, perdidos, aprovados};
    Digital: {top15, needsAttention, perdidos, aprovados};
    IMACX: {top15, needsAttention, perdidos, aprovados};
  };

  // Análises adicionais
  kpi: any;
  topCustomers: Array<{customer_name, total_revenue, invoice_count, ticket_medio}>;
  multiYearRevenue: Array<{cost_center, year, ytd_revenue}>;
  costCenterSales: Array<{cost_center_name, mtd_current, ytd_current, lytd, growth_rate, num_faturas, num_clientes, ticket_medio}>;
  costCenterTopCustomers: Array<{cost_center, customers: Array<{customer_name, total_revenue, invoice_count}>}>;
  rankings: any[];
  monthlyRevenue: Array<{department_name, month, revenue, mom_variation}>;

  // Totais agregados
  totais: {
    orcamentos: {ytd, lytd};
    faturas: {ytd, lytd};
  };
}
```

### 3. GERAÇÃO DO RELATÓRIO

Crie um relatório Markdown profissional e completo com as seguintes seções:

#### 3.1 CABEÇALHO
```markdown
# RELATÓRIO FINANCEIRO IMACX - [MÊS]/[ANO]

**Data:** [data completa por extenso]
**Período:** Year-to-Date (YTD)
**Preparado por:** Sistema de Análise IMACX
```

#### 3.2 SUMÁRIO EXECUTIVO

Tabela de KPIs principais:
- Volume Orçamentos (YTD vs LYTD + variação %)
- Volume Faturas (YTD vs LYTD + variação %)
- Taxa de Conversão global
- Clientes Ativos

Incluir 3-5 destaques principais do período.

#### 3.3 ANÁLISE POR DEPARTAMENTO (DETALHADA)

Para **cada** departamento (Brindes, Digital, IMACX):

**Performance YTD:**
- Orçamentos: valor YTD, LYTD e variação %
- Faturas: valor YTD, LYTD e variação %
- Taxa de Conversão

**Pipeline Comercial:**
- Top 15 Orçamentos: quantidade e valor total
- Necessita Atenção: orçamentos > €7.500 pendentes há 14+ dias
- Perdidos (últimos 60 dias): quantidade
- Aprovados (últimos 60 dias): quantidade

**Análise Crítica:**
- Se conversão < 30%: alertar
- Se crescimento YTD > 20%: destacar positivamente
- Se needsAttention > 5: recomendar ação urgente
- Se perdidos > 15% do pipeline: investigar causas

#### 3.4 ANÁLISE POR CENTRO DE CUSTO

**Tabela de Performance:**
| Centro de Custo | MTD | YTD | LYTD | Crescimento | Nº Faturas | Nº Clientes | Ticket Médio |

Calcular crescimento: `((YTD - LYTD) / LYTD * 100)`

**Top 5 Clientes por Centro de Custo:**
Para cada centro de custo, listar:
- Nome do cliente
- Receita total YTD
- Número de faturas

#### 3.5 TOP 20 CLIENTES YTD

Tabela ranking:
| # | Cliente | Receita YTD | Nº Faturas | Ticket Médio |

**Análise de Concentração:**
- Calcular % de receita dos Top 3
- Calcular % de receita dos Top 10
- Se Top 3 > 50%: ⚠️ Alertar sobre risco de concentração
- Se Top 3 > 60%: 🔴 Risco ALTO - recomendar diversificação urgente

#### 3.6 ANÁLISE TEMPORAL

**Vendas Mensais YTD:**
Tabela com todos os meses do ano até data atual:
- Receita mensal
- Variação MoM (Month-over-Month)
- Número de faturas

**Comparação Multi-Ano:**
Tabela comparando 3 anos (atual, -1, -2):
- Por centro de custo
- Valores YTD comparáveis (mesmo período)

#### 3.7 RANKINGS

Listar departamentos/centros de custo por:
- Receita YTD (maior para menor)
- Crescimento % (maior para menor)
- Taxa de conversão (maior para menor)

#### 3.8 CONCLUSÕES E RECOMENDAÇÕES

**Pontos Fortes:**
Identificar 3-5 aspectos positivos baseados nos dados

**Áreas de Atenção:**
Identificar 3-5 pontos que requerem ação/monitoramento

**Recomendações Estratégicas:**
Fornecer 5-7 ações concretas:
- Se pipeline attention alto: priorizar follow-ups
- Se crescimento negativo: investigar causas
- Se concentração alta: diversificar carteira
- Se conversão baixa: revisar processo comercial
- Oportunidades identificadas nos dados

### 4. FORMATAÇÃO E ESTILO

**Formatação Markdown:**
- Tabelas alinhadas e bem formatadas
- Emojis para seções: 📊 📈 💼 🏆 🎯 🏢 ⚠️ ✅ 🔴 🔔
- **Bold** para valores importantes
- Cores via emojis: ✅ (positivo), ⚠️ (atenção), 🔴 (crítico)

**Formatação de Valores:**
- Moeda: €123.456,78 (ponto para milhares, vírgula para decimais)
- Percentagens: +12,5% ou -3,2%
- Usar 1 casa decimal para %
- Usar 2 casas decimais para valores monetários

**Tom do Relatório:**
- Profissional e objetivo
- Focado em insights, não apenas dados
- Construtivo nas críticas
- Acionável nas recomendações

### 5. ANÁLISE INTELIGENTE

Não apenas reportar dados - ANALISAR e INTERPRETAR:

**Tendências a identificar:**
- Padrões sazonais (comparar meses)
- Mudanças vs ano anterior
- Departamentos em ascensão/declínio
- Clientes crescendo ou diminuindo compras

**Alertas automáticos:**
- Taxa conversão < 25%: 🔴 Crítico
- Taxa conversão < 30%: ⚠️ Atenção
- Crescimento YTD < 0%: 🔴 Crítico
- Crescimento YTD < 5%: ⚠️ Atenção
- Pipeline attention > 10 itens: 🔴 Urgente
- Pipeline attention > 5 itens: ⚠️ Atenção
- Top 3 clientes > 60%: 🔴 Risco ALTO
- Top 3 clientes > 50%: ⚠️ Risco MÉDIO

**Contexto de negócio IMACX:**
- B2B com ciclos de venda 30-60 dias
- Orçamentos > €7.500 são significativos
- Pipeline pendente > 14 dias precisa follow-up
- Taxa conversão saudável: 30-40%
- Crescimento esperado: 10-15% ao ano

### 6. LOCALIZAÇÃO DO OUTPUT

Salvar o relatório em:
```
C:\Users\maria\TEMP\docs\relatorio_financeiro_[NOME_MES]_[ANO].md
```

Exemplo: `relatorio_financeiro_novembro_2025.md`

### 7. EXEMPLO DE ESTRUTURA COMPLETA

```markdown
# RELATÓRIO FINANCEIRO IMACX - NOVEMBRO/2025

**Data:** 15 de Novembro de 2025
**Período:** Year-to-Date (YTD)
**Preparado por:** Sistema de Análise IMACX

---

## 📊 SUMÁRIO EXECUTIVO

### KPIs Principais

| Métrica | YTD 2025 | LYTD 2024 | Variação |
|---------|----------|-----------|----------|
| **Volume Orçamentos** | €2.450.000,00 | €2.100.000,00 | +16,7% ✅ |
| **Volume Faturas** | €1.890.000,00 | €1.650.000,00 | +14,5% ✅ |
| **Taxa de Conversão** | 32,5% | 31,2% | +1,3pp ✅ |
| **Clientes Ativos** | 487 | 456 | +6,8% ✅ |

### 🎯 Destaques do Período

✅ **Crescimento sustentado**: Todos os departamentos apresentam crescimento YTD
🔔 **Pipeline IMACX**: 8 orçamentos significativos (>€7.500) pendentes há 14+ dias requerem atenção
🏆 **Diversificação positiva**: Top 3 clientes representam 45% da receita (risco controlado)
📈 **Digital em alta**: Crescimento de 22% YTD, liderando performance

---

## 💼 ANÁLISE POR DEPARTAMENTO

### Brindes

**Performance YTD**
- Orçamentos: €850.000,00 (+12,5% vs LYTD)
- Faturas: €680.000,00 (+10,8% vs LYTD)
- Taxa Conversão: 34,2% ✅

**Pipeline Comercial**
- Top 15 Orçamentos: 15 (€145.000,00)
- Necessita Atenção: 3 (€28.500,00)
- Perdidos (60d): 12
- Aprovados (60d): 28

**Análise:**
✅ Taxa de conversão saudável acima dos 30%
✅ Crescimento moderado mas consistente
🔔 3 orçamentos importantes pendentes - recomendar follow-up prioritário
✅ Boa proporção aprovados vs perdidos (28:12)

[... continuar para Digital e IMACX ...]

---

## 🏢 ANÁLISE POR CENTRO DE CUSTO

[tabelas e análises...]

## 🏆 TOP 20 CLIENTES YTD

[tabela com ranking...]

## 📈 ANÁLISE TEMPORAL

[vendas mensais e multi-ano...]

## 📊 RANKINGS

[rankings por diferentes métricas...]

## 🎯 CONCLUSÕES E RECOMENDAÇÕES

### Pontos Fortes
1. ✅ Crescimento consistente em todos os departamentos
2. ✅ Taxa de conversão global acima de 30%
3. ✅ Diversificação de clientes em níveis saudáveis

### Áreas de Atenção
1. ⚠️ Pipeline IMACX com 8 orçamentos pendentes há 14+ dias
2. ⚠️ Departamento X com crescimento abaixo da média
3. ⚠️ Cliente Y com redução de 20% nas compras YTD

### Recomendações Estratégicas
1. 🎯 **Urgente**: Follow-up dos 8 orçamentos IMACX pendentes (€75.000 em risco)
2. 🎯 Investigar causas da desaceleração em [departamento]
3. 🎯 Reunião com cliente Y para entender redução de volume
4. 🎯 Replicar práticas do Digital (melhor performer) nos outros departamentos
5. 🎯 Manter foco na execução - momentum positivo atual

---

*Relatório gerado automaticamente pelo Sistema de Análise Financeira IMACX*
*Data de geração: 2025-11-15 19:30:00*
*Para questões: gestao@imacx.pt*
```

## Notas Técnicas Importantes

### Dados de Clientes
- Campo principal: `customer_name`
- Fallback: `nome` ou `client_name`
- Se todos vazios: "Cliente não identificado"

### Cálculos de Variação
```javascript
variacao_percentual = ((ytd - lytd) / lytd) * 100
variacao_pp = taxa_atual - taxa_anterior  // para percentagens
```

### Formatação de Moeda
```javascript
// JavaScript
valor.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

// Manual
€123456.78 → €123.456,78
```

### Períodos de Comparação
- **YTD**: 01/Jan/[ano] até data atual
- **LYTD**: Mesmo período do ano anterior (01/Jan/[ano-1] até mesma data)
- **MTD**: 01 do mês atual até data atual

### Pipeline - Categorias
- **top15**: Orçamentos do mês atual, ordenados por valor, primeiros 15
- **needsAttention**: Status PENDENTE, valor ≥ €7.500, mais de 14 dias
- **perdidos**: Status PERDIDO, últimos 60 dias
- **aprovados**: Status APROVADO, faturados nos últimos 60 dias

## Troubleshooting

**Erro: "Unauthorized" na API**
→ Usuário precisa estar logado. Use método DevTools alternativo.

**Erro: Dados todos a 0€**
→ Verificar se RPC functions existem no Supabase
→ Confirmar tabelas ft/2years_ft têm dados

**Erro: customer_name = "N/A"**
→ Adicionar joins com tabela `cl` nas queries
→ Usar múltiplos fallbacks de campos

**Relatório muito curto**
→ Garantir que TODAS as seções estão incluídas
→ Não resumir - incluir análise completa de cada departamento

## Checklist Pré-Entrega

Antes de finalizar o relatório, verificar:

- [ ] Todas as 8 seções principais incluídas
- [ ] Análise individual dos 3 departamentos
- [ ] Top 20 clientes com dados corretos
- [ ] Análise de centros de custo completa
- [ ] Conclusões com insights reais (não genéricos)
- [ ] Recomendações acionáveis e específicas
- [ ] Formatação consistente (moeda, %, datas)
- [ ] Emojis apropriados para hierarquia visual
- [ ] Valores calculados corretamente
- [ ] Tom profissional mas acessível
- [ ] Arquivo salvo em TEMP/docs/ com nome correto
