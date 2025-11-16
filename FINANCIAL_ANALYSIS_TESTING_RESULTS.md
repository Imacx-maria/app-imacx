# Financial Analysis Page Testing Results
**Date:** 16/11/2025
**Tester:** System Test
**Page:** http://localhost:3000/gestao/analise-financeira

---

## FILTER COMBINATION 1: VISÃO GERAL + Ano Atual (YTD)

### Main KPIs:
- **Receita Total:** 3,211,188 €
  - Report: 3,211,188.32 € ✅ MATCH
  - Ano anterior: 3,519,178 €
  - Variação: -8.8%

- **Nº Faturas:** 1,940
  - Ano anterior: 2,119
  - Variação: -8.4%

- **Nº Clientes:** 184
  - Report: 184 ✅ MATCH
  - Ano anterior: 243
  - Variação: -24.3%

- **Ticket Médio:** 1,754 €
  - Ano anterior: 1,705 €
  - Variação: +2.9%

- **Orçamentos Valor:** 14,442,487 €
  - Report: 14,442,486.65 € ✅ MATCH (rounding)
  - Ano anterior: 21,894,089 €
  - Variação: -34.0%

- **Orçamentos Qtd:** 3,898
  - Ano anterior: 4,734
  - Variação: -17.7%
  - ⚠️ Report shows 112 orçamentos - NEED TO INVESTIGATE

- **Taxa Conversão:** 49.8%
  - Report: 22.2% ❌ MISMATCH
  - Ano anterior: 44.8%
  - Variação: +11.2%

- **Orçamento Médio:** 3,705 €
  - Report: 128,950.77 € ❌ MAJOR MISMATCH
  - Ano anterior: 4,625 €
  - Variação: -19.9%

### Top 20 Clientes YTD:
- **Total:** 660,742 €
  - Report: 660,741.65 € ✅ MATCH (rounding)
  - % do total: 93.7%

**Client List (matches report):**
1. Communisis Portugal, Lda. - 194,756 € (Report: 194,755.71 €) ✅
2. HH PRINT MANAGEMENT [AGRUPADO] - 163,691 € (Report: 163,690.53 €) ✅
3. Altavia Ibérica CFA, SA- SUCURSAL EM PORTUGAL - 88,340 € (Report: 88,339.66 €) ✅
4. KONICA MINOLTA MARKETING SERVICES LIMITED - 52,922 € (Report: 52,922.03 €) ✅
5. Sumol+Compal Marcas, S.A - 52,525 € (Report: 52,525.10 €) ✅
... (all 20 clients match with rounding differences)

⚠️ **ISSUE FOUND:** "Última Fatura" dates show March 2025 instead of November 2025 dates. This appears to be a data display issue.

---

## FILTER COMBINATION 2: VISÃO GERAL + Mês Atual (November 2025)

### Main KPIs:
- **Receita Total:** 173,549 €
- **Nº Faturas:** 85
- **Nº Clientes:** 27
- **Ticket Médio:** 2,042 €
- **Orçamentos Valor:** 616,142 €
- **Orçamentos Qtd:** 136
- **Taxa Conversão:** 62.5%
- **Orçamento Médio:** 4,530 €

### Top 20 Clientes (November):
- **Total:** 172,508 €
- % do total: 99.4%

**Top clients:**
1. GRUPO VENDAP, S.A. - 63,990 €
2. Communisis Portugal, Lda. - 37,128 €
3. PrimeDrinks, S.A - 21,660 €
... (20 clients shown)

---

## CONTINUING TESTS...

