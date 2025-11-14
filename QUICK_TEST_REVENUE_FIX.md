# Quick Test: Revenue Fix Verification

**Expected Result:** YTD revenue should show **€3,584,146.76** (not €1,779,162)

---

## 🚀 Quick Test (2 minutes)

### Step 1: Restart Dev Server

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 2: Test Debug Endpoint

Open in browser:
```
http://localhost:3000/api/financial-analysis/debug-ytd
```

**Look for this in the JSON response:**
```json
{
  "calculations": {
    "netRevenue": 3584146.76  // ← Should be ~3.58 million
  }
}
```

**Check server console logs for:**
```
📊 Total records fetched: XXXX
✅ After filtering for Factura + Nota de Crédito: XXXX records
✅ After excluding anulado='True': XXXX records
💰 Net Revenue (Facturas - Credits): €3,584,146.76
```

### Step 3: Test KPI Dashboard API

Open in browser:
```
http://localhost:3000/api/financial-analysis/kpi-dashboard
```

**Look for YTD revenue in JSON:**
```json
{
  "ytd": {
    "revenue": {
      "current": 3584146.76  // ← Should be ~3.58 million (NOT 1.77 million!)
    }
  }
}
```

### Step 4: Check Frontend UI

Open in browser:
```
http://localhost:3000/gestao/analise-financeira
```

**Verify:**
- [ ] YTD card shows **€3,584,146.76** (or close to it)
- [ ] MTD/QTD values are reasonable
- [ ] No console errors in browser (F12)
- [ ] Charts display correctly

---

## ✅ Success Criteria

| Metric | Before Fix | After Fix | Status |
|--------|-----------|-----------|--------|
| YTD Revenue | €1,779,162 ❌ | €3,584,146.76 ✅ | Check this! |
| Data Loss | ~50% missing | 0% missing | Should be fixed |
| Filters | Supabase `.or()` | JavaScript filter | Fixed |

---

## 🐛 If Still Wrong

### Check Server Logs

Look for these messages in terminal:
```
✅ [KPI Dashboard] YTD current: XXXX records
📊 [KPI Dashboard] YTD Current: Total records=XXXX, Valid records=XXXX
📊 [KPI Dashboard] YTD Current: revenue=3584146.76, invoices=XXXX
```

**Valid records should be close to Total records** (not 50% less)

### Compare with Direct SQL

Run this in Supabase SQL Editor:
```sql
SELECT 
  COALESCE(SUM(CASE 
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as ytd_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');
```

**The SQL result should match the API result exactly.**

---

## 📞 Troubleshooting

### Issue 1: Still showing €1,779,162

**Cause:** Old code still cached
**Fix:** Hard refresh browser (Ctrl+Shift+R) and restart dev server

### Issue 2: Different number (not 3.58M)

**Cause:** Database has different data
**Fix:** Run debug endpoint and compare with SQL query

### Issue 3: Console errors

**Cause:** TypeScript or runtime error
**Fix:** Check terminal for error messages, check file syntax

---

## 📊 What Changed

**OLD CODE (BROKEN):**
```typescript
// ❌ Supabase filters excluded 50% of data
.in("document_type", ["Factura", "Nota de Crédito"])
.or("anulado.is.null,anulado.neq.True")
```

**NEW CODE (FIXED):**
```typescript
// ✅ Fetch ALL data, filter in JavaScript
const { data } = await supabase
  .schema("phc")
  .from("ft")
  .select("...")
  .gte("invoice_date", start)
  .lte("invoice_date", end);

// ✅ Filter in application code (reliable!)
const validInvoices = data.filter((inv) => {
  const isNotCancelled = !inv.anulado || inv.anulado !== "True";
  const isValidType = 
    inv.document_type === "Factura" || 
    inv.document_type === "Nota de Crédito";
  return isNotCancelled && isValidType;
});
```

---

**Test now and verify YTD = €3,584,146.76!** 🎉