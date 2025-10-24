# -*- coding: utf-8 -*-
"""
Annual Historical Sync - End of Year Data Snapshot
===================================================
Runs once per year on December 31st to:
1. Update historical tables with the year that just ended + 2 previous years (3 years total)
2. Populate 2years_bo and 2years_ft tables with last 2 complete years
3. Update monthly aggregation tables (bo_historical_monthly, ft_historical_monthly)
4. Recreate historical database views

Example: When 2025 ends (Dec 31, 2025):
- Historical tables will contain: 2023, 2024, 2025
- 2years tables will contain: 2024, 2025
"""

import sys
import os
from pathlib import Path
from datetime import datetime, date
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
import pyodbc

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add etl_core to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'etl_core'))

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
        conn_str = os.getenv('MSSQL_DIRECT_CONNECTION')
        if not conn_str:
            raise ValueError("MSSQL_DIRECT_CONNECTION not found in environment")
        conn = pyodbc.connect(conn_str, timeout=30)
        return conn
    except Exception as e:
        print(f"❌ PHC connection failed: {e}")
        sys.exit(1)

def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            database=os.getenv('PG_DB'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            port=os.getenv('PG_PORT', '5432'),
            sslmode=os.getenv('PG_SSLMODE', 'require')
        )
        return conn
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

def sync_2years_bo(phc_conn, supabase_conn):
    """
    Sync 2years_bo table with last 2 complete years of BO data
    Example: On 2025-12-31, syncs 2024 and 2025
    """
    print("\n[SYNC] Syncing 2years_bo table...")
    
    current_year = datetime.now().year
    year1 = current_year - 1  # Previous year
    year2 = current_year      # Current year (ending today)
    
    print(f"   Years: {year1}, {year2}")
    
    try:
        # Clear existing data
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute("TRUNCATE TABLE phc.\"2years_bo\"")
        
        # Fetch from PHC
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            bostamp AS document_id,
            obrano AS document_number,
            nmdos AS document_type,
            no AS customer_id,
            dataobra AS document_date,
            obs AS observacoes,
            nomecli AS nome_trabalho,
            origem AS origin,
            etotal AS total_value,
            vendnm AS department,
            usrinis AS created_by,
            datainis AS created_at,
            usralt AS updated_by,
            dataalt AS updated_at
        FROM bo
        WHERE YEAR(dataobra) IN ({year1}, {year2})
        ORDER BY dataobra DESC
        """
        
        phc_cursor.execute(query)
        
        # Insert into Supabase
        insert_sql = """
        INSERT INTO phc."2years_bo" (
            document_id, document_number, document_type, customer_id,
            document_date, observacoes, nome_trabalho, origin, total_value,
            department, created_by, created_at, updated_by, updated_at,
            inserted_at, last_updated
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """
        
        row_count = 0
        while True:
            rows = phc_cursor.fetchmany(1000)
            if not rows:
                break
            
            batch = []
            for row in rows:
                processed_row = []
                for value in row:
                    if isinstance(value, (datetime, date)):
                        processed_row.append(value.strftime('%Y-%m-%d'))
                    else:
                        processed_row.append(value)
                batch.append(tuple(processed_row))
            
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, batch, page_size=500)
            row_count += len(batch)
        
        supabase_conn.commit()
        print(f"[OK] 2years_bo: {row_count} rows synced")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to sync 2years_bo: {e}")
        supabase_conn.rollback()
        return False

def sync_2years_ft(phc_conn, supabase_conn):
    """
    Sync 2years_ft table with last 2 complete years of FT data
    Example: On 2025-12-31, syncs 2024 and 2025
    """
    print("\n[SYNC] Syncing 2years_ft table...")
    
    current_year = datetime.now().year
    year1 = current_year - 1
    year2 = current_year
    
    print(f"   Years: {year1}, {year2}")
    
    try:
        # Clear existing data
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute("TRUNCATE TABLE phc.\"2years_ft\"")
        
        # Fetch from PHC
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            ftstamp AS invoice_id,
            ft AS invoice_number,
            nmdos AS document_type,
            no AS customer_id,
            fdata AS invoice_date,
            nome AS customer_name,
            etotal AS total_value,
            vendnm AS department,
            usrinis AS created_by,
            datainis AS created_at,
            usralt AS updated_by,
            dataalt AS updated_at
        FROM ft
        WHERE YEAR(fdata) IN ({year1}, {year2})
        ORDER BY fdata DESC
        """
        
        phc_cursor.execute(query)
        
        # Insert into Supabase
        insert_sql = """
        INSERT INTO phc."2years_ft" (
            invoice_id, invoice_number, document_type, customer_id,
            invoice_date, customer_name, total_value, department,
            created_by, created_at, updated_by, updated_at,
            inserted_at, last_updated
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """
        
        row_count = 0
        while True:
            rows = phc_cursor.fetchmany(1000)
            if not rows:
                break
            
            batch = []
            for row in rows:
                processed_row = []
                for value in row:
                    if isinstance(value, (datetime, date)):
                        processed_row.append(value.strftime('%Y-%m-%d'))
                    else:
                        processed_row.append(value)
                batch.append(tuple(processed_row))
            
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, batch, page_size=500)
            row_count += len(batch)
        
        supabase_conn.commit()
        print(f"[OK] 2years_ft: {row_count} rows synced")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to sync 2years_ft: {e}")
        supabase_conn.rollback()
        return False

def update_bo_historical_monthly(phc_conn, supabase_conn):
    """
    Update bo_historical_monthly with last 3 years of monthly aggregated data
    Example: On 2025-12-31, updates with 2023, 2024, 2025
    """
    print("\n[SYNC] Updating bo_historical_monthly...")
    
    current_year = datetime.now().year
    year1 = current_year - 2
    year2 = current_year - 1
    year3 = current_year
    
    print(f"   Years: {year1}, {year2}, {year3}")
    
    try:
        # Delete existing data for these years
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute(f"""
            DELETE FROM phc.bo_historical_monthly
            WHERE year IN ({year1}, {year2}, {year3})
        """)
        
        # Aggregate from PHC
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            YEAR(dataobra) AS year,
            MONTH(dataobra) AS month,
            nmdos AS document_type,
            SUM(etotal) AS total_value,
            COUNT(*) AS document_count
        FROM bo
        WHERE YEAR(dataobra) IN ({year1}, {year2}, {year3})
        GROUP BY YEAR(dataobra), MONTH(dataobra), nmdos
        ORDER BY year, month
        """
        
        phc_cursor.execute(query)
        
        # Insert aggregated data
        insert_sql = """
        INSERT INTO phc.bo_historical_monthly (year, month, document_type, total_value, document_count)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        rows = phc_cursor.fetchall()
        if rows:
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, rows, page_size=500)
        
        supabase_conn.commit()
        print(f"[OK] bo_historical_monthly: {len(rows)} monthly records updated")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to update bo_historical_monthly: {e}")
        supabase_conn.rollback()
        return False

def update_bo_historical_monthly_salesperson(phc_conn, supabase_conn):
    """
    Update bo_historical_monthly_salesperson with last 3 years by department
    """
    print("\n[SYNC] Updating bo_historical_monthly_salesperson...")
    
    current_year = datetime.now().year
    year1 = current_year - 2
    year2 = current_year - 1
    year3 = current_year
    
    print(f"   Years: {year1}, {year2}, {year3}")
    
    try:
        # Delete existing data
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute(f"""
            DELETE FROM phc.bo_historical_monthly_salesperson
            WHERE year IN ({year1}, {year2}, {year3})
        """)
        
        # Aggregate from PHC with department
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            YEAR(dataobra) AS year,
            MONTH(dataobra) AS month,
            COALESCE(vendnm, 'UNKNOWN') AS department,
            nmdos AS document_type,
            SUM(etotal) AS total_value,
            COUNT(*) AS document_count
        FROM bo
        WHERE YEAR(dataobra) IN ({year1}, {year2}, {year3})
        GROUP BY YEAR(dataobra), MONTH(dataobra), vendnm, nmdos
        ORDER BY year, month, department
        """
        
        phc_cursor.execute(query)
        
        # Insert aggregated data
        insert_sql = """
        INSERT INTO phc.bo_historical_monthly_salesperson 
        (year, month, department, document_type, total_value, document_count)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        rows = phc_cursor.fetchall()
        if rows:
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, rows, page_size=500)
        
        supabase_conn.commit()
        print(f"[OK] bo_historical_monthly_salesperson: {len(rows)} records updated")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to update bo_historical_monthly_salesperson: {e}")
        supabase_conn.rollback()
        return False

def update_ft_historical_monthly(phc_conn, supabase_conn):
    """
    Update ft_historical_monthly with last 3 years of monthly aggregated data
    """
    print("\n[SYNC] Updating ft_historical_monthly...")
    
    current_year = datetime.now().year
    year1 = current_year - 2
    year2 = current_year - 1
    year3 = current_year
    
    print(f"   Years: {year1}, {year2}, {year3}")
    
    try:
        # Delete existing data
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute(f"""
            DELETE FROM phc.ft_historical_monthly
            WHERE year IN ({year1}, {year2}, {year3})
        """)
        
        # Aggregate from PHC
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            YEAR(fdata) AS year,
            MONTH(fdata) AS month,
            nmdos AS document_type,
            SUM(etotal) AS total_value,
            COUNT(*) AS document_count
        FROM ft
        WHERE YEAR(fdata) IN ({year1}, {year2}, {year3})
        GROUP BY YEAR(fdata), MONTH(fdata), nmdos
        ORDER BY year, month
        """
        
        phc_cursor.execute(query)
        
        # Insert aggregated data
        insert_sql = """
        INSERT INTO phc.ft_historical_monthly (year, month, document_type, total_value, document_count)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        rows = phc_cursor.fetchall()
        if rows:
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, rows, page_size=500)
        
        supabase_conn.commit()
        print(f"[OK] ft_historical_monthly: {len(rows)} monthly records updated")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to update ft_historical_monthly: {e}")
        supabase_conn.rollback()
        return False

def update_ft_historical_monthly_salesperson(phc_conn, supabase_conn):
    """
    Update ft_historical_monthly_salesperson with last 3 years by department
    """
    print("\n[SYNC] Updating ft_historical_monthly_salesperson...")
    
    current_year = datetime.now().year
    year1 = current_year - 2
    year2 = current_year - 1
    year3 = current_year
    
    print(f"   Years: {year1}, {year2}, {year3}")
    
    try:
        # Delete existing data
        supabase_cursor = supabase_conn.cursor()
        supabase_cursor.execute(f"""
            DELETE FROM phc.ft_historical_monthly_salesperson
            WHERE year IN ({year1}, {year2}, {year3})
        """)
        
        # Aggregate from PHC with department
        phc_cursor = phc_conn.cursor()
        query = f"""
        SELECT 
            YEAR(fdata) AS year,
            MONTH(fdata) AS month,
            COALESCE(vendnm, 'UNKNOWN') AS department,
            nmdos AS document_type,
            SUM(etotal) AS total_value,
            COUNT(*) AS document_count
        FROM ft
        WHERE YEAR(fdata) IN ({year1}, {year2}, {year3})
        GROUP BY YEAR(fdata), MONTH(fdata), vendnm, nmdos
        ORDER BY year, month, department
        """
        
        phc_cursor.execute(query)
        
        # Insert aggregated data
        insert_sql = """
        INSERT INTO phc.ft_historical_monthly_salesperson 
        (year, month, department, document_type, total_value, document_count)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        rows = phc_cursor.fetchall()
        if rows:
            psycopg2.extras.execute_batch(supabase_cursor, insert_sql, rows, page_size=500)
        
        supabase_conn.commit()
        print(f"[OK] ft_historical_monthly_salesperson: {len(rows)} records updated")
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to update ft_historical_monthly_salesperson: {e}")
        supabase_conn.rollback()
        return False

def recreate_historical_views():
    """Recreate historical database views"""
    print("\n[VIEW] Recreating historical views...")
    
    try:
        import subprocess
        script_path = Path(__file__).parent / "post_sync_historical_views.py"
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if "__HISTORICAL_VIEW_RECREATION_DONE__ success=true" in result.stdout:
            print("[OK] Historical views recreated successfully")
            return True
        else:
            print("[WARN] Warning: Historical view recreation may have failed")
            print(result.stdout)
            return False
    except Exception as e:
        print(f"[WARN] Warning: Could not recreate historical views: {e}")
        return False

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
    results['2years_bo'] = sync_2years_bo(phc_conn, supabase_conn)
    results['2years_ft'] = sync_2years_ft(phc_conn, supabase_conn)
    
    # Update historical monthly aggregations
    results['bo_historical_monthly'] = update_bo_historical_monthly(phc_conn, supabase_conn)
    results['bo_historical_monthly_salesperson'] = update_bo_historical_monthly_salesperson(phc_conn, supabase_conn)
    results['ft_historical_monthly'] = update_ft_historical_monthly(phc_conn, supabase_conn)
    results['ft_historical_monthly_salesperson'] = update_ft_historical_monthly_salesperson(phc_conn, supabase_conn)
    
    # Close connections
    phc_conn.close()
    supabase_conn.close()
    print("\n[OK] Database connections closed")
    
    # Recreate historical views
    results['historical_views'] = recreate_historical_views()
    
    # Summary
    print("\n" + "=" * 80)
    print("SYNC SUMMARY")
    print("=" * 80)
    for table, success in results.items():
        status = "[OK] SUCCESS" if success else "[ERROR] FAILED"
        print(f"   {table}: {status}")
    
    # Overall result
    all_success = all(results.values())
    
    if all_success:
        print("\n[OK] Annual historical sync completed successfully!")
        print("__ETL_DONE__ success=true")
        sys.exit(0)
    else:
        print("\n[ERROR] Annual historical sync completed with errors!")
        print("__ETL_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

