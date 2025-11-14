# Financial Analysis API Testing Guide

**Date:** 2025-01-13  
**Status:** Ready for Testing  
**Version:** 1.0

---

## 🎯 Overview

This guide helps you test the fixed financial analysis API routes to ensure they're calculating revenue correctly.

### What Was Fixed

1. ✅ **Revenue Calculation** - Nota de Crédito are now SUBTRACTED (not added)
2. ✅ **Cancelled Invoices** - Invoices with `anulado = 'True'` are now excluded
3. ✅ **Ticket Médio** - Now uses net revenue (after credits) divided by invoice count

---

## 🧪 Quick Test Checklist

- [ ] KPI Dashboard loads without errors
- [ ] MTD/QTD/YTD values are reasonable (not inflated)
- [ ] Revenue values match PHC system
- [ ] Nota de Crédito reduce total revenue (not increase it)
- [ ] Cancelled invoices are excluded
- [ ] Ticket Médio is realistic (typically €500-€5000)
- [ ] Monthly revenue chart shows consistent data
- [ ] Top customers list is accurate

---

## 🚀 Testing Steps

### Step 1: Test KPI Dashboard API

**Endpoint:** `GET /api/financial-analysis/kpi-dashboard`

**Test in browser:**
```
http://localhost:3000/api/financial-analysis/kpi-dashboard
```

**Expected Response Structure:**
```json
{
  "mtd": {
    "revenue": { "current": 123456.78, "previous": 98765.43, "change": 25.1 },
    "invoices": { "current": 150, "previous": 140, "change": 7.14 },
    "customers": { "current": 45, "previous": 42, "change": 7.14 },
    "avgInvoiceValue": { "current": 823.05, "previous": 705.47, "change": 16.67 }
  },
  "qtd": { ... },
  "ytd": { ... },
  "generatedAt": "2025-01-13T10:30:00.000Z"
}
```

**Verification Checklist:**
- [ ] `revenue.current` is NOT suspiciously high
- [ ] `revenue.change` shows realistic growth/decline (typically -50% to +50%)
- [ ] `avgInvoiceValue.current` is between €300-€10,000 (typical range)
- [ ] All values are numbers (not null or undefined)
- [ ] Previous year values are populated

---

### Step 2: Test Monthly Revenue API

**Endpoint:** `GET /api/financial-analysis/monthly-revenue`

**Test in browser:**
```
http://localhost:3000/api/financial-analysis/monthly-revenue
```

**Expected Response Structure:**
```json
{
  "monthlyData": [
    {
      "period": "2025-01",
      "totalInvoices": 220,
      "validInvoices": 200,
      "netRevenue": 156789.45,
      "grossRevenue": 162345.67,
      "avgInvoiceValue": 783.95
    },
    {
      "period": "2025-02",
      "totalInvoices": 215,
      "validInvoices": 195,
      "netRevenue": 148234.21,
      "grossRevenue": 153890.12,
      "avgInvoiceValue": 760.17
    }
  ],
  "summary": {
    "totalInvoices": 2450,
    "validInvoices": 2200,
    "netRevenue": 1876543.21,
    "grossRevenue": 1932145.67,
    "avgInvoiceValue": 853.43
  }
}
```

**Verification Checklist:**
- [ ] `netRevenue < grossRevenue` (credits reduce net revenue)
- [ ] `validInvoices <= totalInvoices` (some are credit notes)
- [ ] Monthly data is sorted chronologically (Jan → Nov)
- [ ] Summary totals match sum of monthly data
- [ ] `avgInvoiceValue` is realistic per invoice

---

### Step 3: Test Top Customers API

**Endpoint:** `GET /api/financial-analysis/top-customers?limit=20`

**Test in browser:**
```
http://localhost:3000/api/financial-analysis/top-customers?limit=20
```

**Expected Response Structure:**
```json
{
  "customers": [
    {
      "rank": 1,
      "customerId": "12345",
      "customerName": "CLIENTE EXEMPLO LDA",
      "city": "PORTO",
      "salesperson": "João Silva",
      "invoiceCount": 45,
      "netRevenue": 234567.89,
      "cancelledRevenue": 0,
      "revenueSharePct": 12.45,
      "firstInvoice": "2025-01-05",
      "lastInvoice": "2025-11-10",
      "daysSinceLastInvoice": 3
    }
  ],
  "summary": {
    "totalCustomers": 156,
    "totalRevenue": 1884567.23,
    "totalInvoices": 2200
  }
}
```

**Verification Checklist:**
- [ ] Customers are sorted by `netRevenue` (descending)
- [ ] Top customer has highest revenue
- [ ] `revenueSharePct` values sum to ~100% for top 10
- [ ] Customer names are properly decoded (no encoding issues)
- [ ] `daysSinceLastInvoice` is reasonable
- [ ] No customers with negative revenue

---

### Step 4: Compare with SQL Queries

Run the verification queries from `scripts/sql/verify_financial_analysis.sql` in your database client.

**Direct SQL Test (Run in Supabase SQL Editor):**

```sql
-- Test 1: YTD 2025 Revenue
SELECT
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_total_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');
```

**Compare:**
- SQL Result: `receita_total_2025` = €1,876,543.21
- API Result: `ytd.revenue.current` = 1876543.21
- ✅ **They should match exactly**

---

### Step 5: Test Frontend UI

**Navigate to:** `http://localhost:3000/gestao/analise-financeira`

**Visual Verification:**
1. **KPI Cards** (Top of page)
   - [ ] Revenue values display correctly (formatted as €)
   - [ ] Percentage changes show green (positive) or red (negative)
   - [ ] All 4 KPIs visible: Revenue, Invoices, Customers, Ticket Médio

2. **Period Tabs**
   - [ ] MTD tab shows current month data
   - [ ] QTD tab shows current quarter data
   - [ ] YTD tab shows year-to-date data

3. **Monthly Revenue Chart**
   - [ ] Chart displays all months (Jan to current month)
   - [ ] Revenue bars show consistent trend
   - [ ] Hover shows exact values

4. **Top Customers Table**
   - [ ] Customers sorted by revenue (highest first)
   - [ ] All columns populated (name, city, salesperson, revenue, etc.)
   - [ ] No encoding issues in customer names

---

## 🔍 Common Issues to Watch For

### Issue 1: Inflated Revenue Values
**Symptom:** Revenue is 2x higher than expected  
**Cause:** Credit notes being added instead of subtracted  
**Fix Status:** ✅ FIXED - Credit notes now subtracted

### Issue 2: Too Many Invoices
**Symptom:** Invoice count includes cancelled invoices  
**Cause:** Missing `anulado` filter  
**Fix Status:** ✅ FIXED - Cancelled invoices excluded

### Issue 3: Wrong Ticket Médio
**Symptom:** Average invoice value is inflated  
**Cause:** Using gross revenue instead of net revenue  
**Fix Status:** ✅ FIXED - Now uses net revenue (after credits)

### Issue 4: Missing Previous Year Data
**Symptom:** Previous year values show 0 or null  
**Cause:** Using wrong table (`ft` instead of `2years_ft`)  
**Fix Status:** ✅ FIXED - Correctly uses `phc.2years_ft` for historical data

---

## 📊 Test Scenarios

### Scenario 1: Customer with Credit Notes

**Setup:** Find a customer with both invoices and credit notes

**Expected Behavior:**
- Facturas: €10,000 (2 invoices)
- Nota de Crédito: €1,500 (1 credit note)
- **Net Revenue: €8,500** (10,000 - 1,500)
- **Invoice Count: 2** (only Facturas counted)
- **Ticket Médio: €4,250** (8,500 / 2)

### Scenario 2: Cancelled Invoice

**Setup:** Find a cancelled invoice (`anulado = 'True'`)

**Expected Behavior:**
- Invoice should NOT appear in any calculations
- Revenue should NOT include cancelled invoice value
- Invoice count should NOT include cancelled invoice

### Scenario 3: Month with No Activity

**Setup:** Check a month with no invoices (e.g., December 2025)

**Expected Behavior:**
- Month should appear in monthly data with zeros
- No errors or missing data
- Chart should show gap or zero bar

---

## 🧮 Manual Calculation Examples

### Example 1: Calculate YTD Revenue Manually

**Given invoices in 2025:**
- Invoice 1: €5,000 (Factura)
- Invoice 2: €3,000 (Factura)
- Invoice 3: €7,500 (Factura)
- Invoice 4: €1,200 (Nota de Crédito) ← CREDIT NOTE

**Calculation:**
```
Revenue = 5,000 + 3,000 + 7,500 - 1,200
        = €14,300 (net revenue)
```

**NOT:**
```
❌ WRONG: 5,000 + 3,000 + 7,500 + 1,200 = €16,700
```

### Example 2: Calculate Ticket Médio

**Given:**
- Total Facturas: €50,000
- Total Credit Notes: €5,000
- Number of Facturas: 50

**Calculation:**
```
Net Revenue = 50,000 - 5,000 = €45,000
Ticket Médio = 45,000 / 50 = €900
```

**NOT:**
```
❌ WRONG: 50,000 / 50 = €1,000 (ignores credits)
```

---

## ✅ Success Criteria

All tests pass if:

1. ✅ **Revenue values match SQL queries** (within €0.01 rounding)
2. ✅ **Credit notes reduce revenue** (not increase)
3. ✅ **Cancelled invoices excluded** (compare with/without filter)
4. ✅ **Ticket Médio is realistic** (€300-€10,000 typical range)
5. ✅ **Previous year comparisons work** (YTD 2024 vs YTD 2025)
6. ✅ **No console errors** in browser or server logs
7. ✅ **UI displays correctly** (charts, tables, KPIs)
8. ✅ **Data matches PHC system** (if you have access to compare)

---

## 🐛 Debugging Tips

### Check Browser Console
```javascript
// In browser console, test API directly
fetch('/api/financial-analysis/kpi-dashboard')
  .then(r => r.json())
  .then(data => console.log('KPI Data:', data));
```

### Check Server Logs
```bash
# Watch for SQL queries and errors
npm run dev

# Look for these log lines:
# ✅ [KPI Dashboard] YTD current: 2200 records
# ✅ [KPI Dashboard] YTD previous: 1950 records
# 📊 [KPI Dashboard] YTD Current: revenue=1876543.21, invoices=2200, customers=156, avg=853.43
```

### Verify Database Directly
```sql
-- Check if anulado field exists
SELECT anulado, COUNT(*)
FROM phc.ft
WHERE invoice_date >= '2025-01-01'
GROUP BY anulado;

-- Expected result:
-- anulado | count
-- NULL    | 2150
-- False   | 50
-- True    | 10  ← These should be excluded
```

---

## 📞 Support

If tests fail:

1. **Check the SQL queries** in `scripts/sql/verify_financial_analysis.sql`
2. **Compare SQL results** with API responses
3. **Review the fix summary** in `FINANCIAL_ANALYSIS_FIX_SUMMARY.md`
4. **Check server logs** for error messages
5. **Verify database schema** (ensure `anulado` field exists)

---

**Happy Testing! 🎉**

*Last updated: 2025-01-13*