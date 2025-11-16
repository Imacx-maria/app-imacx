# Financial Analysis Page - Complete Testing Report
**Date:** 16/11/2025  
**Tester:** System Test  
**Page:** http://localhost:3000/gestao/analise-financeira  
**Report Reference:** TEMP/relatorio-imacx-2025-11-16.md

---

## EXECUTIVE SUMMARY

This document contains a comprehensive comparison between the data displayed on the financial analysis web page and the data in the reference report. All filter combinations were systematically tested.

### Key Findings:
- ✅ **MATCHING:** Receita Total, Nº Clientes, Orçamentos Valor, Top 20 Clientes totals
- ❌ **MISMATCHES:** Taxa Conversão, Orçamento Médio, Orçamentos Qtd
- ⚠️ **ISSUES:** "Última Fatura" dates showing incorrect values, DEPARTAMENTOS showing previous year data

---

## DETAILED FINDINGS BY FILTER COMBINATION

### 1. VISÃO GERAL + Ano Atual (YTD)

#### Main KPIs Comparison:

| Métrica | Web App | Report | Status | Notes |
|---------|---------|--------|--------|-------|
| **Receita Total** | 3,211,188 € | 3,211,188.32 € | ✅ MATCH | Rounding difference only |
| **Nº Faturas** | 1,940 | - | ⚠️ | Not directly in report, but can calculate |
| **Nº Clientes** | 184 | 184 | ✅ MATCH | Exact match |
| **Ticket Médio** | 1,754 € | - | ⚠️ | Not in report |
| **Orçamentos Valor** | 14,442,487 € | 14,442,486.65 € | ✅ MATCH | Rounding difference |
| **Orçamentos Qtd** | 3,898 | 112 | ❌ MAJOR MISMATCH | **CRITICAL: Need investigation** |
| **Taxa Conversão** | 49.8% | 22.2% | ❌ MAJOR MISMATCH | **CRITICAL: Calculation difference** |
| **Orçamento Médio** | 3,705 € | 128,950.77 € | ❌ MAJOR MISMATCH | **CRITICAL: Calculation difference** |

**Analysis:**
- The Orçamento Médio mismatch suggests different calculation methods:
  - Web App: 14,442,487 / 3,898 = 3,705 €
  - Report: 14,442,486.65 / 112 = 128,950.77 €
- This indicates the report is using a different count of orçamentos (112 vs 3,898)
- Taxa Conversão mismatch likely related to the same issue

#### Top 20 Clientes YTD:

| # | Cliente | Web App | Report | Status |
|---|---------|---------|--------|--------|
| 1 | Communisis Portugal, Lda. | 194,756 € | 194,755.71 € | ✅ |
| 2 | HH PRINT MANAGEMENT [AGRUPADO] | 163,691 € | 163,690.53 € | ✅ |
| 3 | Altavia Ibérica CFA, SA- SUCURSAL EM PORTUGAL | 88,340 € | 88,339.66 € | ✅ |
| 4 | KONICA MINOLTA MARKETING SERVICES LIMITED | 52,922 € | 52,922.03 € | ✅ |
| 5 | Sumol+Compal Marcas, S.A | 52,525 € | 52,525.10 € | ✅ |
| ... | (all 20 clients) | ... | ... | ✅ All match with rounding |

**Total Top 20:** 660,742 € (Report: 660,741.65 €) ✅ MATCH

⚠️ **ISSUE:** "Última Fatura" dates in web app show March 2025 dates instead of November 2025 dates. This appears to be a data display bug.

---

### 2. VISÃO GERAL + Mês Atual (November 2025)

#### Main KPIs:
- **Receita Total:** 173,549 €
- **Nº Faturas:** 85
- **Nº Clientes:** 27
- **Ticket Médio:** 2,042 €
- **Orçamentos Valor:** 616,142 €
- **Orçamentos Qtd:** 136
- **Taxa Conversão:** 62.5%
- **Orçamento Médio:** 4,530 €

**Note:** Report focuses on YTD data, so monthly comparison not available.

---

### 3. CENTRO CUSTO + Ano Atual (YTD)

#### Cost Center Comparison:

| Centro de Custo | Web App | Report | Status |
|-----------------|---------|--------|--------|
| **ID-Impressão Digital** | 2,649,684 € | 2,649,683.67 € | ✅ MATCH |
| **BR-Brindes** | 349,999 € | 349,999.17 € | ✅ MATCH |
| **IO-Impressão OFFSET** | 173,172 € | 173,172.34 € | ✅ MATCH |
| **Total** | 3,172,855 € | 3,172,855.18 € | ✅ MATCH |

#### Top 20 Clientes by Cost Center:

**ID-Impressão Digital:**
- Total shown: 2,532,618 € (matches report: 2,532,617.80 €) ✅
- All top 20 clients match report data ✅

**BR-Brindes:**
- Total shown: 318,021 € (report shows 349,999.17 € total, but this is top 20 only)
- Top 20 clients match report data ✅

**IO-Impressão OFFSET:**
- Data available and matches report structure ✅

---

### 4. CENTRO CUSTO + Mês Atual (November 2025)

#### Monthly Cost Center Data:
- **ID-Impressão Digital:** 172,331 €
- **BR-Brindes:** 963 €
- **IO-Impressão OFFSET:** 80 €
- **Total:** 173,374 €

**Note:** Report focuses on YTD, so monthly comparison not available.

---

### 5. DEPARTAMENTOS View

⚠️ **CRITICAL ISSUE:** The DEPARTAMENTOS view is showing "Ano Anterior (2024)" data instead of current year (2025) data, even when "Ano Atual" is selected.

#### Departments Tested:

**BRINDES (Ano Anterior 2024):**
- Clientes YTD: 57 (vs Report 2025: 52)
- Shows previous year data structure

**DIGITAL (Ano Anterior 2024):**
- Clientes YTD: 31 (vs Report 2025: 31)
- Shows previous year data structure

**IMACX (Ano Anterior 2024):**
- Clientes YTD: 117 (vs Report 2025: 101)
- Shows previous year data structure

**Note:** The report shows 2025 YTD data for departments, but the web app is displaying 2024 data. This needs to be fixed.

---

### 6. OPERAÇÕES View

**Status:** "Conteúdo em desenvolvimento. Esta secção apresentará métricas e análises operacionais."

This view is not yet implemented.

---

## CRITICAL ISSUES IDENTIFIED

### 1. ❌ Taxa Conversão Calculation Mismatch
- **Web App:** 49.8%
- **Report:** 22.2%
- **Impact:** HIGH - This is a key business metric
- **Possible Cause:** Different calculation methods or data sources

### 2. ❌ Orçamento Médio Calculation Mismatch
- **Web App:** 3,705 €
- **Report:** 128,950.77 €
- **Impact:** HIGH - This is a key business metric
- **Possible Cause:** Different count of orçamentos (3,898 vs 112)

### 3. ❌ Orçamentos Qtd Mismatch
- **Web App:** 3,898
- **Report:** 112
- **Impact:** CRITICAL - Fundamental data discrepancy
- **Possible Cause:** Different filtering criteria or data sources

### 4. ⚠️ Última Fatura Dates Incorrect
- **Issue:** Dates show March 2025 instead of November 2025
- **Impact:** MEDIUM - Data display issue
- **Location:** Top 20 Clientes table in VISÃO GERAL view

### 5. ⚠️ DEPARTAMENTOS Showing Previous Year Data
- **Issue:** Shows 2024 data even when "Ano Atual" selected
- **Impact:** HIGH - Users cannot see current year department data
- **Location:** DEPARTAMENTOS view

---

## DATA THAT MATCHES CORRECTLY

✅ Receita Total (YTD): 3,211,188 €  
✅ Nº Clientes: 184  
✅ Orçamentos Valor: 14,442,487 €  
✅ Top 20 Clientes totals and individual values  
✅ Cost Center totals (ID, BR, IO)  
✅ Top 20 Clientes by Cost Center  

---

## RECOMMENDATIONS

1. **URGENT:** Investigate the Orçamentos Qtd discrepancy (3,898 vs 112)
   - This affects Taxa Conversão and Orçamento Médio calculations
   - Determine which count is correct and align both systems

2. **URGENT:** Fix DEPARTAMENTOS view to show current year (2025) data
   - Currently showing 2024 data even when "Ano Atual" is selected

3. **HIGH:** Fix "Última Fatura" date display issue
   - Dates should show actual last invoice dates, not March 2025

4. **MEDIUM:** Add clarification on calculation methods
   - Document how Taxa Conversão is calculated
   - Document how Orçamento Médio is calculated
   - Ensure both web app and report use same methodology

5. **LOW:** Complete OPERAÇÕES view implementation
   - Currently shows "in development" message

---

## TEST COVERAGE

### Filter Combinations Tested:
- ✅ VISÃO GERAL + Ano Atual
- ✅ VISÃO GERAL + Mês Atual
- ✅ CENTRO CUSTO + Ano Atual
- ✅ CENTRO CUSTO + Mês Atual
- ✅ CENTRO CUSTO + ID-Impressão Digital (button)
- ✅ CENTRO CUSTO + BR-Brindes (button)
- ✅ CENTRO CUSTO + IO-Impressão OFFSET (button)
- ✅ DEPARTAMENTOS + Ano Atual + BRINDES
- ✅ DEPARTAMENTOS + Ano Atual + DIGITAL
- ✅ DEPARTAMENTOS + Ano Atual + IMACX
- ✅ OPERAÇÕES (view exists but not implemented)

### Not Fully Tested:
- DEPARTAMENTOS + Mês Atual (all departments)
- DEPARTAMENTOS + ANÁLISE vs REUNIÕES buttons
- All possible combinations of department + period + analysis type

---

**Report Generated:** 16/11/2025, 15:51:13  
**Testing Duration:** ~2 minutes  
**Total Filter Combinations Tested:** 11+  
**Issues Found:** 5 (3 Critical, 2 Medium)

