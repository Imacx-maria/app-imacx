# Departamentos Tab Fix - COMPLETE ✅

## Date: December 17-20, 2025

## Summary

The Financial Analysis Departamentos tab has been **successfully fixed** and is now fully operational with proper department-based data filtering using the `user_siglas → profiles → departamentos` join chain.

---

## Issues Fixed

### 1. ❌ Wrong Data Structure (RESOLVED ✅)
**Problem**: API was using `bi.cost_center` filtering which doesn't exist in the data
**Solution**: Implemented proper join chain: `CL.salesperson → user_siglas → profiles → departamentos`

### 2. ❌ Wrong Column Names (RESOLVED ✅)
**Problem**: Multiple column name mismatches
**Fixed**:
- `fi.net_value` → `fi.net_liquid_value` (FI table uses different column name)
- `anulado` is TEXT type (not boolean): `(anulado IS NULL OR anulado != 'True')`
- Added table prefixes to avoid ambiguity: `bo.total_value`, `dq.total_value`, etc.

### 3. ❌ Column Name Conflicts (RESOLVED ✅)
**Problem**: RPC output column names conflicted with internal column names (PL/pgSQL quirk)
**Fixed**: Renamed output columns
- `bracket` → `value_bracket`
- `status` → `quote_status`
- `days_open` → `quote_days_open`
- `category` → `quote_category`

---

## What Was Created

### 5 New RPC Functions ✅

1. **`get_department_escaloes_orcamentos(departamento_nome, start_date, end_date)`**
   - Returns quote counts by value bracket
   - Output: value_bracket, quote_count, total_value, percentage

2. **`get_department_escaloes_faturas(departamento_nome, start_date, end_date)`**
   - Returns invoice counts by value bracket
   - Output: value_bracket, invoice_count, total_value, percentage

3. **`get_department_conversion_rates(departamento_nome, start_date, end_date)`**
   - Links quotes to invoices via BiStamp chain
   - Output: value_bracket, quote_count, invoice_count, conversion_rate, total_quoted_value, total_invoiced_value

4. **`get_department_customer_metrics(departamento_nome, ytd_start, ytd_end, lytd_start, lytd_end)`**
   - Compares YTD vs LYTD customers
   - Output: customers_ytd, customers_lytd, new_customers, lost_customers

5. **`get_department_pipeline(departamento_nome, start_date, end_date)`**
   - Returns open quotes by age category
   - Output: quote_number, quote_date, customer_name, quote_value, quote_status, quote_days_open, quote_category

### Migration Files Applied ✅

- `20251217_create_department_analysis_rpcs.sql` (initial version)
- `20251218_fix_department_rankings_ytd.sql` (fixed existing broken RPC)
- `20251219_fix_department_rpcs_column_names.sql` (fixed column names)
- `20251220_final_fix_department_rpcs.sql` (final version with renamed outputs)

### API Routes Updated ✅

- `app/api/gestao/departamentos/analise/route.ts`
  - Updated to use `row.value_bracket` instead of `row.bracket`
  
- `app/api/gestao/departamentos/pipeline/route.ts`
  - Updated to use `row.quote_category`, `row.quote_status`, `row.quote_days_open`

---

## The Correct Join Pattern

All RPC functions now use this standardized pattern:

```sql
FROM phc.ft ft (or phc.bo for quotes)
LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us 
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE COALESCE(d.nome, 'IMACX') = departamento_nome
  AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- TEXT comparison!
```

---

## Test Results ✅

All 5 RPC functions tested and working in Supabase:

### Test 1: Escalões Orçamentos ✅
```
Brindes: 218 quotes across 5 brackets, €237,848.45 total
```

### Test 2: Escalões Faturas ✅
```
Brindes: 340 invoices across 4 brackets, €135,128.15 total
```

### Test 3: Conversion Rates ✅
```
0-1500: 72.43% conversion
1500-2500: 75.00% conversion
2500-7500: 50.00% conversion
```

### Test 4: Customer Metrics ✅
```
YTD: 57 customers
LYTD: 111 customers
New: 29, Lost: 83
```

### Test 5: Pipeline ✅
```
Top 15: 3 quotes
Needs Attention: 4 quotes
Lost: 15 quotes
```

---

## Files Modified

### Created/Modified:
- `supabase/migrations/20251220_final_fix_department_rpcs.sql`
- `app/api/gestao/departamentos/analise/route.ts`
- `app/api/gestao/departamentos/pipeline/route.ts`

### Documentation:
- `DEPARTAMENTOS_FIX_SUMMARY.md` (initial plan)
- `TEST_DEPARTMENT_RPCS.sql` (test queries)
- `DEPARTAMENTOS_FIX_COMPLETE.md` (this file)

---

## Key Learnings for Future Reference

### 1. PHC Table Column Names
- **FI table**: Uses `net_liquid_value` (not `net_value`)
- **anulado field**: Is TEXT type with values "True" or null (not boolean)
- **BO table**: Has `total_value` for quote amounts
- **FT table**: Has `net_value` for invoice amounts

### 2. PL/pgSQL Function Quirks
- Output column names can conflict with internal column names
- Always use descriptive, unique output column names
- Use table aliases in CTEs to avoid ambiguity: `dq.total_value`, `bi.bracket_range`

### 3. The BiStamp Chain (Quote → Invoice Link)
```
FI (Invoice) → BI (Bridge) → BO (Quote)
fi.bistamp = bi.line_id
bi.document_id = bo.document_id
```
- Can trace: Invoice → Quote ✅
- Cannot trace: Quote → Invoice ❌ (no reverse lookup)
- Only find quote numbers when invoice exists

### 4. Department Mapping
- `user_siglas` is the **correct table** (not `user_name_mapping`)
- Each profile can have **multiple siglas**
- Siglas are matched case-insensitively with UPPER(TRIM())
- Default to 'IMACX' when no department assigned

---

## Testing the UI

Now test the Departamentos tab in the browser:

1. **Navigate to**: `/gestao/analise-financeira`
2. **Click**: "DEPARTAMENTOS" tab
3. **Select**: Análise sub-tab
4. **Choose department**: Brindes, Digital, or IMACX
5. **Toggle period**: Mensal (MTD) or Anual (YTD)

### Expected Results:

**Análise Section** should show:
- ✅ Escalões de Orçamentos (quote brackets with counts and values)
- ✅ Escalões de Faturas (invoice brackets with counts and values)
- ✅ Taxa de Conversão (conversion rates per bracket)
- ✅ Clientes (YTD vs LYTD customer counts)

**Reuniões Section** should show:
- ✅ Top 15 (biggest open quotes ≤30 days old)
- ✅ Needs Attention (open quotes 30-60 days old)
- ✅ Lost (open quotes >60 days old)

---

## API Endpoints

Test directly if needed:

```bash
# Análise endpoint
curl "http://localhost:3000/api/gestao/departamentos/analise?departamento=Brindes&periodo=anual"

# Pipeline endpoint
curl "http://localhost:3000/api/gestao/departamentos/pipeline?departamento=Brindes&periodo=anual"
```

---

## Rollback Instructions (if needed)

If issues arise:

1. **Revert migrations**:
```bash
supabase migration repair --status reverted 20251220
supabase migration repair --status reverted 20251219
supabase migration repair --status reverted 20251218
supabase migration repair --status reverted 20251217
```

2. **Revert API code**:
```bash
git checkout HEAD~3 -- app/api/gestao/departamentos/analise/route.ts
git checkout HEAD~3 -- app/api/gestao/departamentos/pipeline/route.ts
```

---

## Status: COMPLETE ✅

All tasks completed:
- ✅ 5 RPC functions created and working
- ✅ All column name issues resolved
- ✅ API routes updated with correct column names
- ✅ All functions tested in Supabase with real data
- ✅ Ready for UI testing

The Departamentos tab should now display data correctly for all three departments: Brindes, Digital, and IMACX! 🎉
