# ETL Scripts Reference Guide

**Last Updated:** 2025-11-16

## Overview

This document describes all main ETL scripts and their purposes. Use this as a reference to understand which script to run for different scenarios.

---

## Main ETL Scripts

### 1. `run_full.py` - Full Sync (Last 1 Year)

**Purpose:** Complete refresh of ALL tables with last 1 year of data

**What it does:**
- **DROPS and RECREATES** all main PHC tables in Supabase
- Syncs 7 tables: `CL, BO, BI, FT, FO, FI, FL`
- Imports **last 1 year** of data (from current date backwards)
- This is a **FULL REPLACEMENT** - not incremental

**Tables synced:**
- `phc.cl` - Customers (all active)
- `phc.bo` - Quotes (last 1 year)
- `phc.bi` - Quote line items (last 1 year)
- `phc.ft` - Invoices (last 1 year)
- `phc.fo` - Folha de Obra documents (last 1 year)
- `phc.fi` - Invoice line items (last 1 year) **← NOW INCLUDES BISTAMP**
- `phc.fl` - Suppliers (all active)

**When to use:**
- ✅ After adding new columns to table configs (like bistamp)
- ✅ After schema changes requiring full data refresh
- ✅ When data integrity issues need a clean slate
- ✅ Monthly maintenance to ensure data consistency

**Duration:** ~5-15 minutes (depends on data volume)

**Command:**
```bash
python scripts/etl/run_full.py
```

---

### 2. `run_annual_historical.py` - Historical Sync (Last 2 Complete Years)

**Purpose:** Populate historical tables for year-over-year comparisons

**What it does:**
- **DROPS and RECREATES** the `2years_*` tables
- Syncs 3 tables: `2years_bo, 2years_ft, 2years_fi`
- Imports **last 2 COMPLETE years** (not current year)
- Example: If run in 2025, imports 2023 + 2024 data

**Tables synced:**
- `phc.2years_bo` - Quotes (2 complete years)
- `phc.2years_ft` - Invoices (2 complete years)
- `phc.2years_fi` - Invoice line items (2 complete years) **← NOW INCLUDES BISTAMP**

**When to use:**
- ✅ After adding new columns that need historical data (like bistamp)
- ✅ End of year (December 31st) to update YoY comparison data
- ✅ When YoY analytics show incorrect data
- ✅ After schema changes to historical tables

**Duration:** ~10-20 minutes (depends on data volume)

**Command:**
```bash
python scripts/etl/run_annual_historical.py
```

---

### 3. `run_fast_all_tables_sync.py` - Fast Incremental Sync (Last 3 Days)

**Purpose:** Quick daily sync for recent changes

**What it does:**
- **Incremental sync** using watermarks
- Only syncs records from **last 3 days**
- Uses upsert (insert or update) - no table drop
- Fast execution for daily automation

**Tables synced:**
- `phc.cl, phc.bo, phc.bi, phc.ft, phc.fo, phc.fi, phc.fl`

**When to use:**
- ✅ Daily automated sync (scheduled task)
- ✅ Quick update after recent data changes
- ✅ When you need latest data without full refresh
- ❌ **NOT suitable after schema changes** - use `run_full.py` instead

**Duration:** ~30 seconds - 2 minutes

**Command:**
```bash
python scripts/etl/run_fast_all_tables_sync.py
```

---

### 4. `run_today_bo_bi.py` - Today's Quotes Sync

**Purpose:** Sync only today's quote data (BO and BI tables)

**What it does:**
- Syncs only **BO** (quotes) and **BI** (quote lines) from today
- Incremental upsert
- Very fast, targeted sync

**When to use:**
- ✅ Real-time quote updates during business hours
- ✅ After creating/updating quotes in PHC
- ✅ Quick refresh of quote pipeline data

**Duration:** ~10-30 seconds

**Command:**
```bash
python scripts/etl/run_today_bo_bi.py
```

---

### 5. `run_today_clients.py` - Today's Customers Sync

**Purpose:** Sync only today's customer data (CL table)

**What it does:**
- Syncs only **CL** (customers) from today
- Incremental upsert
- Very fast, targeted sync

**When to use:**
- ✅ After adding new customers in PHC
- ✅ After updating customer information
- ✅ Quick customer data refresh

**Duration:** ~5-15 seconds

**Command:**
```bash
python scripts/etl/run_today_clients.py
```

---

### 6. `run_today_fl.py` - Today's Suppliers Sync

**Purpose:** Sync only today's supplier data (FL table)

**What it does:**
- Syncs only **FL** (suppliers) from today
- Incremental upsert
- Very fast, targeted sync

**When to use:**
- ✅ After adding new suppliers in PHC
- ✅ After updating supplier information

**Duration:** ~5-15 seconds

**Command:**
```bash
python scripts/etl/run_today_fl.py
```

---

### 7. `run_fl_sync.py` - Full Suppliers Sync

**Purpose:** Complete refresh of suppliers table

**What it does:**
- Syncs ALL active suppliers
- Drops and recreates FL table

**When to use:**
- ✅ After supplier schema changes
- ✅ Periodic supplier data cleanup

**Duration:** ~10-30 seconds

**Command:**
```bash
python scripts/etl/run_fl_sync.py
```

---

### 8. `run_incremental_year.py` - Incremental Year Sync

**Purpose:** Incremental sync for year-to-date data using watermarks

**What it does:**
- Syncs data since last watermark (smart incremental)
- Covers multiple months, not just recent days
- Uses watermark tracking to avoid duplicates

**When to use:**
- ✅ Catch-up sync after missing several days/weeks
- ✅ When `run_fast_all_tables_sync.py` isn't enough
- ❌ **NOT suitable after schema changes** - use `run_full.py` instead

**Duration:** Varies based on time since last sync

**Command:**
```bash
python scripts/etl/run_incremental_year.py
```

---

## Decision Tree: Which Script to Run?

### After Adding New Columns (like bistamp)
```
1. Run: python scripts/etl/run_full.py
   ↓
2. Run: python scripts/etl/run_annual_historical.py
   ↓
3. Verify data integrity
```

### Daily Automation
```
Schedule: python scripts/etl/run_fast_all_tables_sync.py
(Every 6-12 hours or daily)
```

### After Missing Multiple Days
```
Run: python scripts/etl/run_incremental_year.py
```

### Real-time Quote Updates
```
Run: python scripts/etl/run_today_bo_bi.py
```

### Monthly Maintenance
```
1. Run: python scripts/etl/run_full.py
   ↓
2. Verify data quality
```

### End of Year (December 31st)
```
1. Run: python scripts/etl/run_full.py
   ↓
2. Run: python scripts/etl/run_annual_historical.py
   ↓
3. Verify YoY comparisons
```

---

## Important Notes

### ⚠️ When NOT to Use Fast Sync

**DO NOT use `run_fast_all_tables_sync.py` when:**
- You added new columns to table configs
- You changed table schemas
- You need to backfill historical data
- Data integrity issues require full refresh

**Instead use:** `run_full.py` followed by `run_annual_historical.py`

### ✅ Best Practices

1. **After Schema Changes:**
   - Always run `run_full.py` first
   - Then run `run_annual_historical.py` if historical tables affected
   - Never rely on incremental sync after schema changes

2. **Regular Maintenance:**
   - Weekly: Run `run_full.py` 
   - Daily: Run `run_fast_all_tables_sync.py`
   - End of Year: Run `run_annual_historical.py`

3. **Monitoring:**
   - Always check script output for errors
   - Verify row counts after sync
   - Check for `__ETL_DONE__ success=true` at the end

4. **Recovery:**
   - If incremental sync fails, run `run_full.py`
   - If data looks wrong, run `run_full.py`
   - When in doubt, run `run_full.py`

---

## Table Configs Location

All table configurations (columns, mappings, filters) are in:
```
scripts/etl_core/selective_sync.py
```

This file contains the `TABLE_CONFIGS` dictionary with all table definitions.

---

## Post-Sync Views

After successful sync, the script automatically runs:
```
scripts/etl/post_sync_views.py
```

This recreates database views that depend on the synced tables.

---

## Exit Codes

All scripts use standard exit codes:
- `0` = Success
- `1` = Failure

Scripts also emit:
```
__ETL_DONE__ success=true   # On success
__ETL_DONE__ success=false  # On failure
```

This marker is used by API routes to detect sync completion.

---

## Examples

### Example 1: Adding a New Column (bistamp)

```bash
# Step 1: Update table config in scripts/etl_core/selective_sync.py
# Step 2: Create and apply migration
supabase db push

# Step 3: Full sync to populate new column
python scripts/etl/run_full.py

# Step 4: Historical sync to populate historical tables
python scripts/etl/run_annual_historical.py

# Step 5: Verify
# Check row counts, sample data, etc.
```

### Example 2: Daily Automated Sync

```bash
# Scheduled task (runs every 12 hours)
python scripts/etl/run_fast_all_tables_sync.py
```

### Example 3: Monthly Maintenance

```bash
# First day of month
python scripts/etl/run_full.py

# Verify data quality
# Check analytics dashboards
```

---

## Common Issues

### Issue: "Column doesn't exist" error
**Cause:** Using incremental sync after adding new columns  
**Fix:** Run `python scripts/etl/run_full.py`

### Issue: Historical data missing
**Cause:** Only ran `run_full.py` (syncs last 1 year)  
**Fix:** Run `python scripts/etl/run_annual_historical.py`

### Issue: Slow sync performance
**Cause:** Using `run_full.py` when only recent data needed  
**Fix:** Use `python scripts/etl/run_fast_all_tables_sync.py` for daily updates

### Issue: Data looks stale
**Cause:** Incremental sync watermark stuck or outdated  
**Fix:** Run `python scripts/etl/run_full.py` to reset

---

## Summary Table

| Script | Tables | Time Range | Duration | Use Case |
|--------|--------|------------|----------|----------|
| `run_full.py` | 7 main tables | Last 1 year | 5-15 min | Full refresh, schema changes |
| `run_annual_historical.py` | 3 historical tables | Last 2 complete years | 10-20 min | YoY comparisons, historical data |
| `run_fast_all_tables_sync.py` | 7 main tables | Last 3 days | 30s-2 min | Daily incremental sync |
| `run_today_bo_bi.py` | BO, BI only | Today | 10-30s | Real-time quote updates |
| `run_today_clients.py` | CL only | Today | 5-15s | Real-time customer updates |
| `run_today_fl.py` | FL only | Today | 5-15s | Real-time supplier updates |
| `run_fl_sync.py` | FL only | All active | 10-30s | Full supplier refresh |
| `run_incremental_year.py` | 7 main tables | Since watermark | Varies | Catch-up after gaps |

---

**Generated:** 2025-11-16  
**Maintainer:** Development Team  
**Location:** `scripts/etl/README_ETL_SCRIPTS.md`
