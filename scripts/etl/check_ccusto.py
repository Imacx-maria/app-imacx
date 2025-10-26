# -*- coding: utf-8 -*-
"""
Quick script to check ccusto values in PHC ft table
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
    print("CHECKING CCUSTO VALUES IN PHC FT TABLE")
    print("=" * 80)
    
    conn = get_phc_connection()
    print("✅ Connected to PHC\n")
    
    cursor = conn.cursor()
    
    # Query 1: Show distinct ccusto values
    print("📊 DISTINCT CCUSTO VALUES:")
    print("-" * 80)
    query1 = """
    SELECT DISTINCT 
        ccusto,
        COUNT(*) as count
    FROM ft
    WHERE YEAR(fdata) = 2025
      AND ccusto IS NOT NULL
      AND LTRIM(RTRIM(ccusto)) <> ''
    GROUP BY ccusto
    ORDER BY count DESC
    """
    
    cursor.execute(query1)
    rows = cursor.fetchall()
    
    if rows:
        print(f"Found {len(rows)} distinct ccusto values:\n")
        for row in rows:
            print(f"  '{row[0]}' → {row[1]:,} records")
    else:
        print("❌ No ccusto values found (all NULL or empty)")
    
    # Query 2: Sample records with ccusto
    print("\n" + "=" * 80)
    print("📋 SAMPLE RECORDS WITH CCUSTO:")
    print("-" * 80)
    query2 = """
    SELECT TOP 10
        fno,
        fdata,
        nmdoc,
        vendnm,
        ccusto,
        ettiliq
    FROM ft
    WHERE YEAR(fdata) = 2025
      AND ccusto IS NOT NULL
      AND LTRIM(RTRIM(ccusto)) <> ''
    ORDER BY fdata DESC
    """
    
    cursor.execute(query2)
    rows = cursor.fetchall()
    
    if rows:
        print(f"\nShowing {len(rows)} sample records:\n")
        print(f"{'Invoice':<10} {'Date':<12} {'Type':<15} {'Salesperson':<15} {'CCusto':<20} {'Value':>12}")
        print("-" * 100)
        for row in rows:
            print(f"{row[0]:<10} {str(row[1]):<12} {row[2]:<15} {row[3]:<15} {row[4]:<20} {row[5]:>12,.2f}")
    else:
        print("❌ No records with ccusto found")
    
    # Query 3: Count empty vs filled
    print("\n" + "=" * 80)
    print("📊 CCUSTO STATISTICS FOR 2025:")
    print("-" * 80)
    query3 = """
    SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN ccusto IS NULL OR LTRIM(RTRIM(ccusto)) = '' THEN 1 ELSE 0 END) as empty_ccusto,
        SUM(CASE WHEN ccusto IS NOT NULL AND LTRIM(RTRIM(ccusto)) <> '' THEN 1 ELSE 0 END) as filled_ccusto
    FROM ft
    WHERE YEAR(fdata) = 2025
    """
    
    cursor.execute(query3)
    row = cursor.fetchone()
    
    total = row[0]
    empty = row[1]
    filled = row[2]
    
    print(f"\nTotal records 2025: {total:,}")
    print(f"Empty ccusto:       {empty:,} ({(empty/total*100):.1f}%)")
    print(f"Filled ccusto:      {filled:,} ({(filled/total*100):.1f}%)")
    
    conn.close()
    print("\n✅ Done!")

if __name__ == "__main__":
    main()

