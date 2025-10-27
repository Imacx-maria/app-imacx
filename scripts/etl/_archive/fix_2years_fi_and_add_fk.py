#!/usr/bin/env python3
"""
Fix 2years_fi table and add foreign keys
=========================================
1. Truncate 2years_fi (remove test data with wrong date range)
2. Run sync_2years_fi from run_annual_historical.py 
3. Add foreign key constraint
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Add etl modules to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'etl_core'))
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

from run_annual_historical import get_phc_connection, get_supabase_connection, sync_2years_fi

def main():
    print("=" * 80)
    print("FIX 2YEARS_FI AND ADD FOREIGN KEY")
    print("=" * 80)
    
    # Step 1: Resync 2years_fi with proper date range
    print("\n[STEP 1] Resyncing 2years_fi with correct date range...")
    print("-" * 80)
    
    phc_conn = get_phc_connection()
    supabase_conn = get_supabase_connection()
    
    success = sync_2years_fi(phc_conn, supabase_conn)
    
    phc_conn.close()
    supabase_conn.close()
    
    if not success:
        print("\n[ERROR] Failed to resync 2years_fi")
        sys.exit(1)
    
    # Step 2: Add foreign key constraint
    print("\n[STEP 2] Adding foreign key constraint...")
    print("-" * 80)
    
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    try:
        print("Adding foreign key: phc.2years_fi -> phc.2years_ft...")
        cursor.execute('''
            ALTER TABLE phc."2years_fi" 
            ADD CONSTRAINT fk_2years_fi_invoice 
            FOREIGN KEY (invoice_id) 
            REFERENCES phc."2years_ft"(invoice_id) 
            ON DELETE CASCADE
        ''')
        conn.commit()
        print("[OK] Foreign key added")
        
        # Create indexes
        print("\nCreating indexes...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_invoice_id ON phc."2years_fi"(invoice_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_cost_center ON phc."2years_fi"(cost_center)')
        conn.commit()
        print("[OK] Indexes created")
        
        print("\n" + "=" * 80)
        print("SUCCESS")
        print("=" * 80)
        print("[OK] 2years_fi resynced with correct date range")
        print("[OK] Foreign key constraint added")
        print("[OK] Indexes created")
        print("\nBoth FI tables now have foreign keys:")
        print("  - phc.fi.invoice_id -> phc.ft.invoice_id")
        print("  - phc.2years_fi.invoice_id -> phc.2years_ft.invoice_id")
        
    except psycopg2.errors.DuplicateObject:
        conn.rollback()
        print("[OK] Foreign key already exists")
    except Exception as e:
        print(f"\n[ERROR] Failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()

