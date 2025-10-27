# -*- coding: utf-8 -*-
"""
Quick script to check anulado values in PHC ft table
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
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

def main():
    print("=" * 80)
    print("CHECKING ANULADO VALUES IN PHC FT TABLE")
    print("=" * 80)
    
    conn = get_phc_connection()
    print("✅ Connected to PHC\n")
    
    cursor = conn.cursor()
    
    # Query 1: Show distinct anulado values
    print("📊 DISTINCT ANULADO VALUES:")
    print("-" * 80)
    query1 = """
    SELECT 
        anulado,
        COUNT(*) as count
    FROM ft
    WHERE YEAR(fdata) = 2025
    GROUP BY anulado
    ORDER BY count DESC
    """
    
    cursor.execute(query1)
    rows = cursor.fetchall()
    
    if rows:
        print(f"Found {len(rows)} distinct anulado values:\n")
        for row in rows:
            anulado_display = f"'{row[0]}'" if row[0] is not None else "NULL"
            print(f"  {anulado_display:<20} → {row[1]:,} records")
    else:
        print("❌ No data found")
    
    # Query 2: Sample records with different anulado values
    print("\n" + "=" * 80)
    print("📋 SAMPLE RECORDS BY ANULADO VALUE:")
    print("-" * 80)
    
    # Get samples for each distinct value
    query2 = """
    SELECT DISTINCT anulado FROM ft WHERE YEAR(fdata) = 2025
    """
    cursor.execute(query2)
    distinct_values = cursor.fetchall()
    
    for (anulado_val,) in distinct_values[:5]:  # Show samples for first 5 values
        anulado_display = f"'{anulado_val}'" if anulado_val is not None else "NULL"
        print(f"\n  Samples where anulado = {anulado_display}:")
        
        query_sample = """
        SELECT TOP 3
            fno,
            fdata,
            nmdoc,
            vendnm,
            anulado,
            ettiliq
        FROM ft
        WHERE YEAR(fdata) = 2025
          AND """ + (f"anulado = ?" if anulado_val is not None else "anulado IS NULL") + """
        ORDER BY fdata DESC
        """
        
        if anulado_val is not None:
            cursor.execute(query_sample, (anulado_val,))
        else:
            cursor.execute(query_sample)
        
        samples = cursor.fetchall()
        for row in samples:
            anulado_col = f"'{row[4]}'" if row[4] is not None else "NULL"
            print(f"    Invoice {row[0]:<8} | {str(row[1]):<12} | anulado={anulado_col:<10} | Value: {row[5]:>10,.2f}")
    
    # Query 3: Count by anulado status
    print("\n" + "=" * 80)
    print("📊 ANULADO STATISTICS FOR 2025:")
    print("-" * 80)
    query3 = """
    SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN anulado IS NULL OR anulado = '' OR anulado = '0' OR UPPER(anulado) = 'N' OR UPPER(anulado) = 'FALSE' THEN 1 ELSE 0 END) as not_cancelled,
        SUM(CASE WHEN anulado IS NOT NULL AND anulado <> '' AND anulado <> '0' AND UPPER(anulado) <> 'N' AND UPPER(anulado) <> 'FALSE' THEN 1 ELSE 0 END) as cancelled
    FROM ft
    WHERE YEAR(fdata) = 2025
    """
    
    cursor.execute(query3)
    row = cursor.fetchone()
    
    total = row[0]
    not_cancelled = row[1]
    cancelled = row[2]
    
    print(f"\nTotal records 2025:     {total:,}")
    print(f"NOT Cancelled:          {not_cancelled:,} ({(not_cancelled/total*100):.1f}%)")
    print(f"Cancelled (anulado):    {cancelled:,} ({(cancelled/total*100):.1f}%)")
    
    # Query 4: Check data type and length
    print("\n" + "=" * 80)
    print("📋 COLUMN INFO:")
    print("-" * 80)
    query4 = """
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ft' AND COLUMN_NAME = 'anulado'
    """
    
    cursor.execute(query4)
    col_info = cursor.fetchone()
    
    if col_info:
        print(f"\nColumn Name: {col_info[0]}")
        print(f"Data Type:   {col_info[1]}")
        print(f"Max Length:  {col_info[2] if col_info[2] else 'N/A'}")
        print(f"Nullable:    {col_info[3]}")
    
    conn.close()
    print("\n✅ Done!")

if __name__ == "__main__":
    main()

