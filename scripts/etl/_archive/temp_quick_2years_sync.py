# -*- coding: utf-8 -*-
"""
TEMPORARY: Quick FT Sync (Current Year)
=================================================
Fast sync for testing - syncs current year ft table with salesperson_name column
"""

import sys
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
import pyodbc

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

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

def quick_sync_ft(phc_conn, supabase_conn):
    """Sync ft table - October only"""
    print("\n[SYNC] Syncing ft table (October 2025 ONLY)...")
    
    current_year = datetime.now().year
    current_month = datetime.now().month
    
    print(f"   Year: {current_year} | Month: {current_month}")
    
    try:
        phc_cursor = phc_conn.cursor()
        supabase_cursor = supabase_conn.cursor()
        
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
            vendnm          -- Column 7 → salesperson_name (TEXT)
        FROM ft
        WHERE YEAR(fdata) = {current_year}
          AND MONTH(fdata) = {current_month}
          AND COALESCE(CONVERT(VARCHAR(10), anulado), '') IN ('', '0', 'N')
        ORDER BY fdata DESC
        """
        
        print(f"   📥 Fetching October data from PHC...", flush=True)
        phc_cursor.execute(query)
        
        # Delete October data from ft
        supabase_cursor.execute(f'''
            DELETE FROM phc.ft 
            WHERE EXTRACT(YEAR FROM invoice_date) = {current_year}
              AND EXTRACT(MONTH FROM invoice_date) = {current_month}
        ''')
        supabase_conn.commit()
        
        batch_size = 1000
        total_rows = 0
        batch_num = 0
        
        while True:
            rows = phc_cursor.fetchmany(batch_size)
            if not rows:
                break
            
            batch_num += 1
            
            # Clean and prepare data (8 columns from PHC)
            clean_rows = []
            for row in rows:
                clean_row = []
                
                for i, val in enumerate(row):
                    if val is None:
                        clean_row.append(None)
                    elif i == 1:  # fno (invoice_number) - INTEGER
                        try:
                            clean_row.append(int(float(val)) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 2:  # no (customer_id) - INTEGER
                        try:
                            clean_row.append(int(float(val)) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    elif i == 5:  # ettiliq (net_value) - NUMERIC
                        try:
                            clean_row.append(float(val) if val is not None else None)
                        except (ValueError, TypeError):
                            clean_row.append(None)
                    else:  # TEXT or DATE fields (including anulado, vendnm)
                        clean_row.append(str(val).strip() if val else None)
                
                clean_rows.append(tuple(clean_row))
            
            # Insert batch - all 8 columns from PHC
            if clean_rows:
                insert_sql = '''
                INSERT INTO phc.ft (
                    "invoice_id", "invoice_number", "customer_id", "invoice_date",
                    "document_type", "net_value", "anulado", "salesperson_name"
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                '''
                
                supabase_cursor.executemany(insert_sql, clean_rows)
                supabase_conn.commit()
                
                total_rows += len(clean_rows)
                print(f"   [BATCH] Batch {batch_num}: {total_rows:,} rows synced...", end='\r', flush=True)
        
        print(f"   [OK] Completed: {total_rows:,} rows synced" + " " * 20)
        return True
        
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        supabase_conn.rollback()
        return False

def quick_sync_2years_bo(phc_conn, supabase_conn):
    """Quick sync - ONLY October 2025"""
    print("\n[SYNC] Quick syncing 2years_bo (October 2025 ONLY)...")
    
    current_year = datetime.now().year
    current_month = datetime.now().month
    
    print(f"   Year: {current_year} | Month: {current_month}")
    
    try:
        phc_cursor = phc_conn.cursor()
        supabase_cursor = supabase_conn.cursor()
        
        # DROP and recreate table completely
        supabase_cursor.execute('DROP TABLE IF EXISTS phc."2years_bo" CASCADE')
        supabase_cursor.execute('''
            CREATE TABLE phc."2years_bo" (
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
                PRIMARY KEY ("document_id")
            )
        ''')
        supabase_conn.commit()
        
        # Query PHC - get ALL columns as they are
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
            [ultfact]
        FROM [bo]
        WHERE YEAR(dataobra) = {current_year}
          AND MONTH(dataobra) = {current_month}
        ORDER BY dataobra DESC
        """
        
        print(f"   📥 Fetching October data from PHC...", flush=True)
        phc_cursor.execute(query)
        rows = phc_cursor.fetchall()
        
        if not rows:
            print(f"   ⚠️  No data found for month {current_month}")
            return True
        
        # Clean and prepare data
        clean_rows = []
        for row in rows:
            clean_row = []
            for i, val in enumerate(row):
                if val is None:
                    clean_row.append(None)
                elif i == 3:  # no (customer_id) - INTEGER
                    try:
                        clean_row.append(int(float(val)) if val is not None else None)
                    except (ValueError, TypeError):
                        clean_row.append(None)
                elif i == 8:  # ebo_2tvall (total_value) - NUMERIC
                    try:
                        clean_row.append(float(val) if val is not None else None)
                    except (ValueError, TypeError):
                        clean_row.append(None)
                else:  # TEXT or DATE fields
                    clean_row.append(str(val).strip() if val else None)
            
            clean_rows.append(tuple(clean_row))
        
        # Insert batch
        if clean_rows:
            insert_sql = '''
            INSERT INTO phc."2years_bo" (
                "document_id", "document_number", "document_type", "customer_id",
                "document_date", "observacoes", "nome_trabalho", "origin",
                "total_value", "last_delivery_date"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            '''
            
            supabase_cursor.executemany(insert_sql, clean_rows)
            supabase_conn.commit()
            
            print(f"   ✅ Synced {len(clean_rows):,} rows")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        supabase_conn.rollback()
        return False

def main():
    print("=" * 80)
    print("TEMPORARY: QUICK FT SYNC (CURRENT YEAR)")
    print("=" * 80)
    print(f"   Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Syncing current year ft table with salesperson_name")
    print()
    
    # Connect to databases
    print("[CONN] Connecting to databases...")
    phc_conn = get_phc_connection()
    print("✅ Connected to PHC")
    supabase_conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Quick sync
    ft_success = quick_sync_ft(phc_conn, supabase_conn)
    
    # Close connections
    phc_conn.close()
    supabase_conn.close()
    print("\n✅ Database connections closed")
    
    # Summary
    print("\n" + "=" * 80)
    print("SYNC SUMMARY")
    print("=" * 80)
    print(f"   ft: {'✅ SUCCESS' if ft_success else '❌ FAILED'}")
    
    if ft_success:
        print("\n✅ FT sync completed!")
        sys.exit(0)
    else:
        print("\n❌ FT sync failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

