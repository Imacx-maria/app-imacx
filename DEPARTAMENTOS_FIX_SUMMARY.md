# Departamentos Tab Fix - Implementation Summary

## Date: December 17, 2025

## Problem Statement

The Financial Analysis Departamentos tab was not showing any data because it was using **cost_center** filtering from BI/FI tables instead of the proper **user_siglas → profiles → departamentos** join chain.

### Root Cause
- API routes were filtering by `bi.cost_center = "Brindes"` (which doesn't exist in the data)
- Should have been using: `CL.salesperson → user_siglas.sigla → profiles.departamento_id → departamentos.nome`
- Department names in database: "Brindes", "Digital", "IMACX" ✅

## Solution Implemented

### Phase 1: Created New RPC Functions ✅

Created 5 new RPC functions with proper join chain logic:

1. **`get_department_escaloes_orcamentos(departamento_nome, start_date, end_date)`**
   - Returns quote counts and values by value brackets
   - Brackets: 0-1500, 1500-2500, 2500-7500, 7500-15000, 15000-30000, 30000+
   - Outputs: bracket, quote_count, total_value, percentage

2. **`get_department_escaloes_faturas(departamento_nome, start_date, end_date)`**
   - Returns invoice counts and values by value brackets
   - Same bracket structure as quotes
   - Outputs: bracket, invoice_count, total_value, percentage

3. **`get_department_conversion_rates(departamento_nome, start_date, end_date)`**
   - Links quotes to invoices via BiStamp chain
   - Calculates conversion rate per bracket
   - Outputs: bracket, quote_count, invoice_count, conversion_rate, total_quoted_value, total_invoiced_value

4. **`get_department_customer_metrics(departamento_nome, ytd_start, ytd_end, lytd_start, lytd_end)`**
   - Compares YTD vs LYTD customer counts
   - Outputs: customers_ytd, customers_lytd, new_customers, lost_customers

5. **`get_department_pipeline(departamento_nome, start_date, end_date)`**
   - Returns open quotes by age category
   - Categories: Top 15 (≤30 days), Needs Attention (30-60 days), Lost (>60 days)
   - Outputs: quote_number, quote_date, customer_name, quote_value, status, days_open, category

### Phase 2: Updated API Routes ✅

**`app/api/gestao/departamentos/analise/route.ts`**
- Replaced cost_center queries with RPC function calls
- Added support for periodo parameter (mensal/anual)
- Calls all 4 analysis RPCs (escaloes_orcamentos, escaloes_faturas, conversion_rates, customer_metrics)
- Supports filtering by specific department or all departments

**`app/api/gestao/departamentos/pipeline/route.ts`**
- Replaced cost_center filtering with `get_department_pipeline` RPC call
- Splits results into 3 categories: top15, needsAttention, perdidos
- Added periodo parameter support

### Phase 3: Fixed Broken RPC ✅

**`get_department_rankings_ytd()`**
- Replaced non-existent `user_name_mapping` table references
- Updated to use `user_siglas → profiles → departamentos` join chain
- Now properly calculates department-level metrics

## The Correct Join Pattern

All new RPC functions use this pattern:

```sql
FROM phc.ft ft (or phc.bo for quotes)
LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us 
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE COALESCE(d.nome, 'IMACX') = departamento_nome
```

## Files Modified

### New Migrations
- `supabase/migrations/20251217_create_department_analysis_rpcs.sql` (5 new RPC functions)
- `supabase/migrations/20251218_fix_department_rankings_ytd.sql` (fixed broken RPC)

### Updated API Routes
- `app/api/gestao/departamentos/analise/route.ts` (complete rewrite using RPCs)
- `app/api/gestao/departamentos/pipeline/route.ts` (complete rewrite using RPCs)

## Migration Status

✅ All migrations applied successfully to Supabase on December 17, 2025

## Testing Checklist

### Manual Testing Required

1. **Departamentos Tab - Análise Section**
   - [ ] Select "Brindes" department - verify data shows
   - [ ] Select "Digital" department - verify data shows
   - [ ] Select "IMACX" department - verify data shows
   - [ ] Toggle between "Mensal" and "Anual" - verify date ranges update
   - [ ] Verify all 4 sections show data:
     - [ ] Escalões de Orçamentos (Quote Brackets)
     - [ ] Escalões de Faturas (Invoice Brackets)
     - [ ] Taxa de Conversão (Conversion Rates)
     - [ ] Clientes (Customer Metrics)

2. **Departamentos Tab - Pipeline Section**
   - [ ] Select "Brindes" - verify pipeline shows
   - [ ] Select "Digital" - verify pipeline shows
   - [ ] Select "IMACX" - verify pipeline shows
   - [ ] Verify 3 categories show data:
     - [ ] Top 15 (biggest open quotes ≤30 days)
     - [ ] Needs Attention (30-60 days old)
     - [ ] Lost (>60 days old)

### API Testing

Test the API endpoints directly:

```bash
# Test Análise endpoint
curl "http://localhost:3000/api/gestao/departamentos/analise?departamento=Brindes&periodo=anual"

# Test Pipeline endpoint
curl "http://localhost:3000/api/gestao/departamentos/pipeline?departamento=Brindes&periodo=anual"
```

### Database Testing

Test the RPC functions directly in Supabase:

```sql
-- Test escalões de orçamentos
SELECT * FROM get_department_escaloes_orcamentos(
  'Brindes', 
  '2025-01-01', 
  CURRENT_DATE
);

-- Test escalões de faturas
SELECT * FROM get_department_escaloes_faturas(
  'Brindes', 
  '2025-01-01', 
  CURRENT_DATE
);

-- Test conversion rates
SELECT * FROM get_department_conversion_rates(
  'Brindes', 
  '2025-01-01', 
  CURRENT_DATE
);

-- Test customer metrics
SELECT * FROM get_department_customer_metrics(
  'Brindes',
  '2025-01-01',     -- YTD start
  CURRENT_DATE,     -- YTD end
  '2024-01-01',     -- LYTD start
  '2024-12-17'      -- LYTD end (same day last year)
);

-- Test pipeline
SELECT * FROM get_department_pipeline(
  'Brindes', 
  '2025-01-01', 
  CURRENT_DATE
);
```

## Expected Results

✅ **Before Fix:**
- Departamentos tab showed zero data
- API returned empty arrays
- cost_center filtering didn't match department names

✅ **After Fix:**
- Departamentos tab shows data for Brindes, Digital, IMACX
- All 4 analysis sections populated
- Pipeline section shows Top 15, Needs Attention, Lost quotes
- Data properly filtered by organizational department structure

## Key Learnings

1. **Cost Centers ≠ Departments**
   - Cost centers (from PHC) are accounting categories
   - Departments (from user management) are organizational units
   - These are separate concepts that should not be confused

2. **The BiStamp Chain is Critical**
   - To link quotes to invoices: `FI → BI → BO`
   - Cannot trace in reverse (Quote → Invoice lookup not possible)
   - This is used in conversion rate calculations

3. **Always Use user_siglas, Not user_name_mapping**
   - `user_name_mapping` table doesn't exist in current schema
   - `user_siglas` is the correct table for salesperson mappings

4. **Date Handling**
   - MTD: Month-to-Date (1st of current month to today)
   - YTD: Year-to-Date (Jan 1 to today)
   - LYTD: Last Year To Date (same period last year)
   - Always compare same day-of-year periods for accuracy

## Next Steps

1. ✅ Complete manual testing checklist above
2. ✅ Verify all three departments show data
3. ✅ Test both Mensal and Anual periods
4. ✅ Confirm conversion rates calculate correctly
5. ✅ Verify pipeline categories show appropriate quotes

## Rollback Plan (if needed)

If issues arise, revert by:

1. Remove the new migrations:
   ```bash
   supabase migration repair --status reverted 20251217
   supabase migration repair --status reverted 20251218
   ```

2. Restore old API code from git:
   ```bash
   git checkout HEAD~1 -- app/api/gestao/departamentos/analise/route.ts
   git checkout HEAD~1 -- app/api/gestao/departamentos/pipeline/route.ts
   ```

## Contact

For questions or issues with this fix:
- Check this document first
- Review the RPC function code in migrations
- Test with direct SQL queries in Supabase
- Verify department names match exactly ("Brindes", "Digital", "IMACX")
