# -*- coding: utf-8 -*-
"""
Quick script to check what columns exist in Supabase phc.ft table
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

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

def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            dbname=os.getenv("PG_DB"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            port=os.getenv("PG_PORT", "5432")
        )
        return conn
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

def main():
    print("=" * 80)
    print("CHECKING SUPABASE PHC.FT TABLE STRUCTURE")
    print("=" * 80)
    
    conn = get_supabase_connection()
    print("✅ Connected to Supabase\n")
    
    cursor = conn.cursor()
    
    # Query 1: Show all columns in phc.ft
    print("📊 COLUMNS IN phc.ft TABLE:")
    print("-" * 80)
    query1 = """
    SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'phc' AND table_name = 'ft'
    ORDER BY ordinal_position
    """
    
    cursor.execute(query1)
    rows = cursor.fetchall()
    
    if rows:
        print(f"Found {len(rows)} columns:\n")
        for row in rows:
            col_name = row[0]
            data_type = row[1]
            max_length = f"({row[2]})" if row[2] else ""
            nullable = "NULL" if row[3] == 'YES' else "NOT NULL"
            default = f" DEFAULT {row[4]}" if row[4] else ""
            print(f"  {col_name:<30} {data_type}{max_length:<15} {nullable:<10} {default}")
    else:
        print("❌ No columns found")
    
    # Query 2: Check if vendnm and ccusto exist and have data
    print("\n" + "=" * 80)
    print("📋 CHECKING VENDNM AND CCUSTO COLUMNS:")
    print("-" * 80)
    
    # Check if columns exist
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'phc' AND table_name = 'ft' 
          AND column_name IN ('vendnm', 'ccusto', 'salesperson_name')
    """)
    existing_cols = [row[0] for row in cursor.fetchall()]
    
    if existing_cols:
        print(f"\n✅ Found these columns: {', '.join(existing_cols)}\n")
        
        # Check data in these columns
        for col in existing_cols:
            print(f"📊 Statistics for '{col}' column:")
            cursor.execute(f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT({col}) as filled,
                    COUNT(CASE WHEN {col} IS NULL OR TRIM({col}) = '' THEN 1 END) as empty
                FROM phc.ft
                WHERE EXTRACT(YEAR FROM invoice_date) = 2025
            """)
            stats = cursor.fetchone()
            total, filled, empty = stats
            print(f"  Total rows (2025):  {total:,}")
            print(f"  Filled:             {filled:,} ({(filled/total*100) if total > 0 else 0:.1f}%)")
            print(f"  Empty/NULL:         {empty:,} ({(empty/total*100) if total > 0 else 0:.1f}%)")
            
            # Sample values
            cursor.execute(f"""
                SELECT DISTINCT {col}
                FROM phc.ft
                WHERE {col} IS NOT NULL AND TRIM({col}) <> ''
                  AND EXTRACT(YEAR FROM invoice_date) = 2025
                LIMIT 10
            """)
            samples = cursor.fetchall()
            if samples:
                sample_values = ', '.join([f"'{row[0]}'" for row in samples])
                print(f"  Sample values: {sample_values}")
            print()
    else:
        print("\n❌ Neither 'vendnm', 'ccusto', nor 'salesperson_name' columns exist in phc.ft\n")
    
    # Query 3: Show anulado statistics
    print("=" * 80)
    print("📊 ANULADO COLUMN IN SUPABASE:")
    print("-" * 80)
    
    cursor.execute("""
        SELECT 
            anulado,
            COUNT(*) as count
        FROM phc.ft
        WHERE EXTRACT(YEAR FROM invoice_date) = 2025
        GROUP BY anulado
        ORDER BY count DESC
    """)
    rows = cursor.fetchall()
    
    if rows:
        print(f"\nFound {len(rows)} distinct anulado values:\n")
        for row in rows:
            anulado_display = f"'{row[0]}'" if row[0] is not None else "NULL"
            print(f"  {anulado_display:<20} → {row[1]:,} records")
    
    conn.close()
    print("\n✅ Done!")

if __name__ == "__main__":
    main()

