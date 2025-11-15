# -*- coding: utf-8 -*-
"""
Annual Historical Sync - End of Year Data Snapshot
===================================================
Runs once per year on December 31st to:
1. Populate 2years_bo and 2years_ft tables with last 2 complete years

Example: When running in 2025:
- 2years_bo and 2years_ft tables will contain: 2023, 2024 (full year data)
- These tables are used by get_department_rankings_ytd() RPC function for YoY comparisons
"""

import os
import sys
from datetime import date, datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
import pyodbc
from dotenv import load_dotenv

if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# Add etl_core to path
sys.path.insert(0, str(Path(__file__).parent.parent / "etl_core"))

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break
else:
    load_dotenv()


def get_phc_connection():
    """Connect to PHC SQL Server"""
    try:
        conn_str = os.getenv("MSSQL_DIRECT_CONNECTION")
        if not conn_str:
            raise ValueError("MSSQL_DIRECT_CONNECTION not found in environment")
        conn = pyodbc.connect(conn_str, timeout=30)
        return conn
    except Exception as e:
        print(f"[ERROR] PHC connection failed: {e}")
        sys.exit(1)


def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            database=os.getenv("PG_DB"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            port=os.getenv("PG_PORT", "5432"),
            sslmode=os.getenv("PG_SSLMODE", "require"),
        )
        return conn
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        sys.exit(1)


def sync_2years_bo(phc_conn, supabase_conn):
    """
    Sync 2years_bo table with last 2 complete years of BO data
    Example: In 2025, syncs 2023 and 2024
    """
    print("\n[SYNC] Syncing 2years_bo table...")

    current_year = datetime.now().year
    year1 = current_year - 2  # 2 years ago
    year2 = current_year - 1  # Previous year

    print(f"   Years: {year1}, {year2}")

    try:
        phc_cursor = phc_conn.cursor()
        supabase_cursor = supabase_conn.cursor()

        # Ensure table exists with exact same structure as bo table
        supabase_cursor.execute("""
            CREATE TABLE IF NOT EXISTS phc."2years_bo" (
                "document_id" TEXT NOT NULL,
                "document_number" TEXT NOT NULL,
                "document_type" TEXT,
                "customer_id" INTEGER,
                "document_date" DATE,
                "observacoes" TEXT,
                "nome_trabalho" TEXT,
                "origin" TEXT,
                "total_value" NUMERIC,
                "last_delivery_date" DATE,
                "created_by" TEXT,
                PRIMARY KEY ("document_id")
            )
        """)
        supabase_conn.commit()

        # Truncate table
        supabase_cursor.execute('TRUNCATE TABLE phc."2years_bo"')
        supabase_conn.commit()

        # Query PHC - match the exact columns from the bo table config
        # Note: marca is used instead of ultfact for delivery date
        query = f"""
        SELECT
            [bostamp],
            [obrano],
            [nmdos],
            [no],
            [dataobra],
            [obranome],
            [obs],
            [origem],
            [ebo_2tvall],
            [marca],
            [ousrinis]
        FROM [bo]
        WHERE YEAR(dataobra) IN ({year1}, {year2})
        ORDER BY dataobra DESC
        """

        phc_cursor.execute(query)

        batch_size = 1000
        total_rows = 0
        batch_num = 0

        print(f"   [FETCH] Fetching data from PHC...", flush=True)

        while True:
            rows = phc_cursor.fetchmany(batch_size)
            if not rows:
                break

            batch_num += 1

            # Clean and prepare data (same logic as selective_sync)
            clean_rows = []
            for row in rows:
                clean_row = []
                for i, val in enumerate(row):
                    if val is None:
                        clean_row.append(None)
                    elif i == 3:  # no (customer_id) - INTEGER
                        try:
                            clean_row.append(
                                int(float(val)) if val is not None else None
                            )
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 4:  # dataobra (document_date) - DATE
                        if val:
                            if isinstance(val, datetime):
                                clean_row.append(val.strftime("%Y-%m-%d"))
                            elif isinstance(val, date):
                                clean_row.append(val.strftime("%Y-%m-%d"))
                            else:
                                clean_row.append(str(val).strip() if val else None)
                        else:
                            clean_row.append(None)
                    elif i == 8:  # ebo_2tvall (total_value) - NUMERIC
                        try:
                            clean_row.append(float(val) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif (
                        i == 9
                    ):  # marca (last_delivery_date) - DATE stored as VARCHAR "DD.MM.YYYY"
                        if val:
                            try:
                                # Parse DD.MM.YYYY format
                                if isinstance(val, (datetime, date)):
                                    parsed_date = (
                                        val if isinstance(val, date) else val.date()
                                    )
                                else:
                                    date_str = str(val).strip()
                                    # Return None for empty strings or invalid formats
                                    if not date_str or date_str == "":
                                        clean_row.append(None)
                                        continue
                                    # Try DD.MM.YYYY format first
                                    try:
                                        parsed_date = datetime.strptime(
                                            date_str, "%d.%m.%Y"
                                        ).date()
                                    except ValueError:
                                        # Try other common formats
                                        parsed_date = None
                                        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                                            try:
                                                parsed_date = datetime.strptime(
                                                    date_str, fmt
                                                ).date()
                                                break
                                            except ValueError:
                                                continue
                                        # If all parsing fails, store as NULL (handles "13/02 QUINTA" etc.)
                                        if not parsed_date:
                                            clean_row.append(None)
                                            continue
                                clean_row.append(parsed_date.strftime("%Y-%m-%d"))
                            except (ValueError, TypeError):
                                # If parsing fails, store as NULL
                                clean_row.append(None)
                        else:
                            clean_row.append(None)
                    elif i == 10:  # ousrinis (created_by) - TEXT
                        clean_row.append(str(val).strip() if val else None)
                    else:  # TEXT fields
                        clean_row.append(str(val).strip() if val else None)

                clean_rows.append(tuple(clean_row))

            # Insert batch
            if clean_rows:
                insert_sql = """
                INSERT INTO phc."2years_bo" (
                    "document_id", "document_number", "document_type", "customer_id",
                    "document_date", "observacoes", "nome_trabalho", "origin",
                    "total_value", "last_delivery_date", "created_by"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """

                supabase_cursor.executemany(insert_sql, clean_rows)
                supabase_conn.commit()

                total_rows += len(clean_rows)
                print(
                    f"   [BATCH] Batch {batch_num}: {total_rows:,} rows synced...",
                    end="\r",
                    flush=True,
                )

        print(f"   [OK] Completed: {total_rows:,} rows synced" + " " * 20)
        print(f"[OK] 2years_bo: {total_rows:,} rows synced")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to sync 2years_bo: {e}")
        supabase_conn.rollback()
        return False


def sync_2years_ft(phc_conn, supabase_conn):
    """
    Sync 2years_ft table with last 2 complete years of FT data
    Example: In 2025, syncs 2023 and 2024 (all 12 months)
    """
    print("\n[SYNC] Syncing 2years_ft table...")

    current_year = datetime.now().year
    year1 = current_year - 2  # 2 years ago
    year2 = current_year - 1  # Previous year

    print(f"   Years: {year1}, {year2}")

    try:
        phc_cursor = phc_conn.cursor()
        supabase_cursor = supabase_conn.cursor()

        # DROP and recreate table completely
        supabase_cursor.execute('DROP TABLE IF EXISTS phc."2years_ft" CASCADE')
        supabase_cursor.execute("""
            CREATE TABLE phc."2years_ft" (
                "invoice_id" TEXT NOT NULL,
                "invoice_number" INTEGER NOT NULL,
                "customer_id" INTEGER,
                "invoice_date" DATE,
                "document_type" TEXT,
                "net_value" NUMERIC,
                "anulado" TEXT,
                "salesperson_name" TEXT,
                "customer_name" TEXT,
                "created_by" TEXT,
                PRIMARY KEY ("invoice_id")
            )
        """)
        supabase_conn.commit()

        # Query PHC - FT TABLE (Invoices) IMPORT
        query = f"""
        SELECT
            ftstamp,        -- Column 0 → invoice_id (TEXT)
            fno,            -- Column 1 → invoice_number (INTEGER)
            no,             -- Column 2 → customer_id (INTEGER)
            fdata,          -- Column 3 → invoice_date (DATE)
            nmdoc,          -- Column 4 → document_type (TEXT)
            ettiliq,        -- Column 5 → net_value (NUMERIC)
            anulado,        -- Column 6 → anulado (TEXT)
            vendnm,         -- Column 7 → salesperson_name (TEXT)
            nome,           -- Column 8 → customer_name (TEXT)
            ousrinis        -- Column 9 → created_by (TEXT)
        FROM ft
        WHERE YEAR(fdata) IN ({year1}, {year2})
          AND COALESCE(CONVERT(VARCHAR(10), anulado), '') IN ('', '0', 'N')
        ORDER BY fdata DESC
        """

        phc_cursor.execute(query)

        batch_size = 1000
        total_rows = 0
        batch_num = 0

        print(f"   [FETCH] Fetching data from PHC...", flush=True)

        while True:
            rows = phc_cursor.fetchmany(batch_size)
            if not rows:
                break

            batch_num += 1

            # Clean and prepare data (10 columns from PHC)
            clean_rows = []
            for row in rows:
                clean_row = []

                for i, val in enumerate(row):
                    if val is None:
                        clean_row.append(None)
                    elif i == 1:  # fno (invoice_number) - INTEGER
                        try:
                            clean_row.append(
                                int(float(val)) if val is not None else None
                            )
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 2:  # no (customer_id) - INTEGER
                        try:
                            clean_row.append(
                                int(float(val)) if val is not None else None
                            )
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 5:  # ettiliq (net_value) - NUMERIC
                        try:
                            clean_row.append(float(val) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    else:  # TEXT or DATE fields (including anulado, vendnm, nome, ousrinis)
                        clean_row.append(str(val).strip() if val else None)

                clean_rows.append(tuple(clean_row))

            # Insert batch - all 10 columns from PHC
            if clean_rows:
                insert_sql = """
                INSERT INTO phc."2years_ft" (
                    "invoice_id", "invoice_number", "customer_id", "invoice_date",
                    "document_type", "net_value", "anulado", "salesperson_name",
                    "customer_name", "created_by"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """

                supabase_cursor.executemany(insert_sql, clean_rows)
                supabase_conn.commit()

                total_rows += len(clean_rows)
                print(
                    f"   [BATCH] Batch {batch_num}: {total_rows:,} rows synced...",
                    end="\r",
                    flush=True,
                )

        print(f"   [OK] Completed: {total_rows:,} rows synced" + " " * 20)
        print(f"[OK] 2years_ft: {total_rows:,} rows synced")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to sync 2years_ft: {e}")
        supabase_conn.rollback()
        return False


def sync_2years_fi(phc_conn, supabase_conn):
    """
    Sync 2years_fi table with last 2 complete years of FI data (Invoice Line Items)
    Example: In 2025, syncs 2023 and 2024 (ALL months 1-12)
    """
    print("\n[SYNC] Syncing 2years_fi table...")

    current_year = datetime.now().year
    year1 = current_year - 2  # 2 years ago
    year2 = current_year - 1  # Previous year

    print(f"   Years: {year1}, {year2} (Full years - months 1-12)")

    try:
        phc_cursor = phc_conn.cursor()
        supabase_cursor = supabase_conn.cursor()

        # DROP and recreate table completely
        supabase_cursor.execute('DROP TABLE IF EXISTS phc."2years_fi" CASCADE')
        supabase_cursor.execute("""
            CREATE TABLE phc."2years_fi" (
                "line_item_id" TEXT NOT NULL,
                "invoice_id" TEXT NOT NULL,
                "document_number" INTEGER,
                "invoice_date" DATE,
                "cost_center" TEXT,
                "salesperson_name" TEXT,
                "net_liquid_value" NUMERIC,
                PRIMARY KEY ("line_item_id")
            )
        """)
        supabase_conn.commit()

        # FULL YEARS: All months from both years
        # Filter out cancelled documents via FT join
        # Only lines with values (non-zero)
        query = f"""
        SELECT
            fi.fistamp,        -- Column 0 → line_item_id (TEXT)
            fi.ftstamp,        -- Column 1 → invoice_id (TEXT)
            fi.fno,            -- Column 2 → document_number (INTEGER)
            ft.fdata,          -- Column 3 → invoice_date (DATE)
            fi.ficcusto,       -- Column 4 → cost_center (TEXT)
            fi.fivendnm,       -- Column 5 → salesperson_name (TEXT)
            fi.etiliquido      -- Column 6 → net_liquid_value (NUMERIC)
        FROM fi
        JOIN ft ON ft.ftstamp = fi.ftstamp
        WHERE YEAR(ft.fdata) IN ({year1}, {year2})
          AND COALESCE(CONVERT(VARCHAR(10), ft.anulado), '') IN ('', '0', 'N')
          AND fi.etiliquido IS NOT NULL
          AND fi.etiliquido <> 0
        ORDER BY ft.fdata DESC
        """

        phc_cursor.execute(query)

        batch_size = 1000
        total_rows = 0
        batch_num = 0

        print(f"   [FETCH] Fetching data from PHC...", flush=True)

        while True:
            rows = phc_cursor.fetchmany(batch_size)
            if not rows:
                break

            batch_num += 1

            # Clean and prepare data (7 columns from PHC)
            clean_rows = []
            for row in rows:
                clean_row = []

                for i, val in enumerate(row):
                    if val is None:
                        clean_row.append(None)
                    elif i == 2:  # fno (document_number) - INTEGER
                        try:
                            clean_row.append(
                                int(float(val)) if val is not None else None
                            )
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 6:  # etiliquido (net_liquid_value) - NUMERIC
                        try:
                            clean_row.append(float(val) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    else:  # TEXT or DATE fields
                        clean_row.append(str(val).strip() if val else None)

                clean_rows.append(tuple(clean_row))

            # Insert batch - all 7 columns from PHC
            if clean_rows:
                insert_sql = """
                INSERT INTO phc."2years_fi" (
                    "line_item_id", "invoice_id", "document_number", "invoice_date",
                    "cost_center", "salesperson_name", "net_liquid_value"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """

                supabase_cursor.executemany(insert_sql, clean_rows)
                supabase_conn.commit()

                total_rows += len(clean_rows)
                print(
                    f"   [BATCH] Batch {batch_num}: {total_rows:,} rows synced...",
                    end="\r",
                    flush=True,
                )

        print(f"   [OK] Completed: {total_rows:,} rows synced" + " " * 20)
        print(f"[OK] 2years_fi: {total_rows:,} rows synced")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to sync 2years_fi: {e}")
        supabase_conn.rollback()
        return False


# REMOVED: update_bo_historical_monthly and update_ft_historical_monthly
# These tables are no longer used. Analytics now uses get_department_rankings_ytd() RPC function
# which directly queries phc.2years_bo and phc.2years_ft


def main():
    print("=" * 80)
    print("ANNUAL HISTORICAL SYNC - END OF YEAR DATA SNAPSHOT")
    print("=" * 80)
    print(f"   Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Year ending: {datetime.now().year}")
    print()

    # Connect to databases
    print("[CONN] Connecting to databases...")
    phc_conn = get_phc_connection()
    print("[OK] Connected to PHC")
    supabase_conn = get_supabase_connection()
    print("[OK] Connected to Supabase")

    results = {}

    # Sync 2-year snapshot tables
    results["2years_bo"] = sync_2years_bo(phc_conn, supabase_conn)
    results["2years_ft"] = sync_2years_ft(phc_conn, supabase_conn)
    results["2years_fi"] = sync_2years_fi(phc_conn, supabase_conn)

    # Close connections
    phc_conn.close()
    supabase_conn.close()
    print("\n[OK] Database connections closed")

    # Recreate view after successful sync
    all_success = all(results.values())
    if all_success:
        print("\n[VIEW] Recreating database view...")
        try:
            import subprocess

            post_sync_script = PROJECT_ROOT / "scripts" / "etl" / "post_sync_views.py"
            if post_sync_script.exists():
                result = subprocess.run(
                    [sys.executable, str(post_sync_script)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                print(result.stdout)
                if result.returncode != 0:
                    print(f"[WARN] View recreation failed: {result.stderr}")
        except Exception as e:
            print(f"[WARN] Error running post-sync view: {e}")

    # Summary
    print("\n" + "=" * 80)
    print("SYNC SUMMARY")
    print("=" * 80)
    for table, success in results.items():
        status = "[OK] SUCCESS" if success else "[ERROR] FAILED"
        print(f"   {table}: {status}")

    # Overall result (already calculated above for view recreation)
    if all_success:
        print("\n[OK] Annual historical sync completed successfully!")
        print("__ETL_DONE__ success=true")
        sys.exit(0)
    else:
        print("\n[ERROR] Annual historical sync completed with errors!")
        print("__ETL_DONE__ success=false")
        sys.exit(1)

        sys.exit(1)


if __name__ == "__main__":
    main()
