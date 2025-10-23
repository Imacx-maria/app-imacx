# ETL Scripts - PHC to Supabase Synchronization

This directory contains Python ETL (Extract, Transform, Load) scripts that synchronize data from PHC (your ERP system) to Supabase PostgreSQL database.

## 📁 Directory Structure

```
scripts/
├── etl/                      # ETL runner scripts
│   ├── run_full.py          # Full sync (all records, last 1 year)
│   ├── run_incremental.py   # Incremental sync (last 7 days)
│   ├── run_fast_all_tables_sync.py  # Fast sync for all tables (last 3 days)
│   ├── run_fast_bo_bi_sync.py       # Fast sync for BO/BI tables only
│   └── run_fast_client_sync.py      # Fast sync for clients only
├── etl_core/                # Core ETL modules
│   ├── selective_sync.py    # Main sync logic with watermarking
│   └── phc_sync.py         # Basic sync utilities (legacy)
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## 🔧 Setup

### 1. Install Python Dependencies

```bash
# From the scripts/ directory
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Add these to your `.env.local` file in the project root:

```env
# PHC Database Connection (SQL Server)
MSSQL_DIRECT_CONNECTION=DRIVER={SQL Server};SERVER=your-server;DATABASE=your-db;UID=user;PWD=pass

# Supabase/PostgreSQL Connection
PG_HOST=your-project.supabase.co
PG_DB=postgres
PG_USER=postgres
PG_PASSWORD=your-password
PG_PORT=5432
PG_SSLMODE=require

# ETL Configuration
ETL_SCRIPTS_PATH=C:\path\to\imacx-clean\scripts\etl
PYTHON_PATH=python  # or full path to python.exe
```

### 3. Set ETL_SCRIPTS_PATH in .env.local

The Next.js API routes need to know where the ETL scripts are located:

```env
ETL_SCRIPTS_PATH=C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean\scripts\etl
```

## 🚀 Usage

### From Next.js Application (Recommended)

Use the ETL sync buttons in the application UI (Dashboard page):

- **Full Sync**: Syncs all tables (CL, BO, BI, FT, FO) for the last 1 year
- **Incremental Sync**: Syncs only the last 7 days (faster)
- **Fast Sync (All Tables)**: Watermark-based sync for last 3 days (fastest)
- **Fast Sync (BO/BI)**: Watermark-based sync for BO/BI tables only

### Manual Execution

You can also run the scripts directly from the command line:

```bash
# Navigate to project root
cd C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean

# Full sync (last 1 year) - Takes 15-20 minutes
python scripts/etl/run_full.py

# Incremental sync (last 7 days) - Takes 2-5 minutes
python scripts/etl/run_incremental.py

# Fast sync all tables (last 3 days with watermarks) - Takes 30-60 seconds
python scripts/etl/run_fast_all_tables_sync.py

# Fast sync BO/BI only - Takes 10-20 seconds
python scripts/etl/run_fast_bo_bi_sync.py

# Fast sync clients only - Takes 5-10 seconds
python scripts/etl/run_fast_client_sync.py
```

## 📊 Sync Types Explained

### 1. Full Sync (`run_full.py`)
- **Duration**: 15-20 minutes
- **Tables**: CL, BO, BI, FT, FO
- **Data Range**: Last 1 year from current date
- **Method**: Complete table recreation with all records
- **Use Case**: Initial setup, data recovery, major data issues

### 2. Incremental Sync (`run_incremental.py`)
- **Duration**: 2-5 minutes
- **Tables**: CL, BO, BI, FT, FO
- **Data Range**: Last 7 days
- **Method**: Upsert (insert or update) based on primary keys
- **Use Case**: Daily updates, catching up after downtime

### 3. Fast Sync - All Tables (`run_fast_all_tables_sync.py`)
- **Duration**: 30-60 seconds
- **Tables**: CL, BO, BI, FT, FO
- **Data Range**: Last 3 days (with watermarks)
- **Method**: Watermark-based incremental sync
- **Use Case**: Frequent updates, real-time sync, automated workflows

### 4. Fast Sync - BO/BI Only (`run_fast_bo_bi_sync.py`)
- **Duration**: 10-20 seconds
- **Tables**: BO, BI, CL (skips CL if synced < 24h ago)
- **Data Range**: Last 3 days (with watermarks)
- **Method**: Watermark-based incremental sync
- **Use Case**: Document updates without syncing all tables

### 5. Fast Sync - Clients Only (`run_fast_client_sync.py`)
- **Duration**: 5-10 seconds
- **Tables**: CL only
- **Data Range**: All clients
- **Method**: Basic sync
- **Use Case**: Customer data updates only

## 🔄 Watermark System

The fast sync methods use a watermark system to track the last sync date for each table:

- Watermarks are stored in `phc.sync_watermarks` table
- Each table has its own watermark (last synced date)
- Syncs include a 3-day overlap to catch late updates
- CL (customers) table is skipped if synced within last 24 hours

**Benefits:**
- Dramatically faster sync times (seconds vs minutes)
- Reduces database load
- Safe for frequent execution
- Automatic overlap handling

## 📋 Synced Tables

| Table | Description | Primary Key | Date Column | Incremental |
|-------|-------------|-------------|-------------|-------------|
| **CL** | Customers | customer_id | None | No |
| **BO** | Work Orders/Budgets | document_id | document_date | Yes |
| **BI** | Document Lines | line_id | (via BO) | Yes |
| **FT** | Invoices/Credit Notes | invoice_id | invoice_date | Yes |
| **FO** | Folha de Obra Documents | document_id | document_date | Yes |

## 🔒 Data Retention

- **BO, BI, FT, FO**: Keep records from current year onwards
- **CL**: Keep all customers (active and inactive)
- Old records are automatically purged during incremental syncs

## 🎯 Best Practices

1. **Initial Setup**: Run `run_full.py` once to populate all data
2. **Daily Operations**: Use `run_fast_all_tables_sync.py` for quick updates
3. **After Issues**: Run `run_incremental.py` to catch up on last 7 days
4. **Regular Maintenance**: Schedule `run_full.py` weekly to refresh all data

## 🐛 Troubleshooting

### Connection Issues

**Problem**: `❌ PHC connection failed`
- Check `MSSQL_DIRECT_CONNECTION` in `.env.local`
- Verify SQL Server is accessible from your machine
- Test connection with SQL Server Management Studio

**Problem**: `❌ Supabase connection failed`
- Check `PG_HOST`, `PG_USER`, `PG_PASSWORD` in `.env.local`
- Verify Supabase project is active
- Check firewall/network settings

### Import Errors

**Problem**: `ModuleNotFoundError: No module named 'pyodbc'`
- Run: `pip install -r requirements.txt`

**Problem**: `ModuleNotFoundError: No module named 'selective_sync'`
- Verify you're running from project root
- Check that `scripts/etl_core/selective_sync.py` exists

### Sync Failures

**Problem**: ETL sync times out
- Use faster sync methods (`run_fast_*.py`)
- Check network bandwidth
- Verify PHC database performance

**Problem**: Data not appearing in Supabase
- Check `phc` schema exists in Supabase
- Verify row-level security (RLS) policies
- Run full sync to recreate tables

## 📈 Performance Tips

1. **Use Fast Syncs**: Watermark-based syncs are 10-20x faster
2. **Schedule Wisely**: Run syncs during low-traffic periods
3. **Monitor Watermarks**: Check `phc.sync_watermarks` table
4. **Clean Data**: Remove orphaned records periodically

## 🔗 Integration with Next.js

The ETL scripts are integrated with the Next.js application through API routes:

- **API Endpoint**: `/api/etl/`
- **Routes**: `full`, `incremental`, `annual-update`, `prepare-year`
- **Configuration**: Set `ETL_SCRIPTS_PATH` in `.env.local`

The API routes execute these Python scripts and monitor their output for success/failure markers.

## 📝 Output Format

All scripts emit a completion marker:

```
__ETL_DONE__ success=true
```

or

```
__ETL_DONE__ success=false
```

The Next.js API routes monitor this marker to determine sync status.

## 🆘 Support

For issues or questions:
1. Check the logs in console output
2. Review `phc.sync_watermarks` table in Supabase
3. Run preview methods in `selective_sync.py` to inspect data
4. Contact system administrator

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Maintained by**: IMACX Development Team

