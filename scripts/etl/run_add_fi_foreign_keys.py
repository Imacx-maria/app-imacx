#!/usr/bin/env python3
"""
Add Foreign Key Constraints for FI Tables
==========================================
Adds foreign keys, indexes, and constraints to enforce relationship between FI and FT tables
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

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
        print(f"[ERROR] Supabase connection failed: {e}")
        sys.exit(1)

def main():
    print("=" * 80)
    print("ADDING FOREIGN KEY CONSTRAINTS FOR FI TABLES")
    print("=" * 80)
    
    conn = get_supabase_connection()
    print("[OK] Connected to Supabase\n")
    
    cursor = conn.cursor()
    
    try:
        # 1. Add foreign key for fi table
        print("[1/6] Adding foreign key: phc.fi -> phc.ft...")
        try:
            cursor.execute('''
                ALTER TABLE phc.fi 
                ADD CONSTRAINT fk_fi_invoice 
                FOREIGN KEY (invoice_id) 
                REFERENCES phc.ft(invoice_id) 
                ON DELETE CASCADE
            ''')
            conn.commit()
            print("      [OK] Foreign key added")
        except psycopg2.errors.DuplicateObject:
            conn.rollback()
            print("      [SKIP] Foreign key already exists")
        
        # 2. Add foreign key for 2years_fi table
        print("\n[2/6] Adding foreign key: phc.2years_fi -> phc.2years_ft...")
        try:
            cursor.execute('''
                ALTER TABLE phc."2years_fi" 
                ADD CONSTRAINT fk_2years_fi_invoice 
                FOREIGN KEY (invoice_id) 
                REFERENCES phc."2years_ft"(invoice_id) 
                ON DELETE CASCADE
            ''')
            conn.commit()
            print("      [OK] Foreign key added")
        except psycopg2.errors.DuplicateObject:
            conn.rollback()
            print("      [SKIP] Foreign key already exists")
        
        # 3. Create index on fi.invoice_id
        print("\n[3/6] Creating index: idx_fi_invoice_id...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fi_invoice_id ON phc.fi(invoice_id)')
        conn.commit()
        print("      [OK] Index created")
        
        # 4. Create index on 2years_fi.invoice_id
        print("\n[4/6] Creating index: idx_2years_fi_invoice_id...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_invoice_id ON phc."2years_fi"(invoice_id)')
        conn.commit()
        print("      [OK] Index created")
        
        # 5. Create index on fi.cost_center
        print("\n[5/6] Creating index: idx_fi_cost_center...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fi_cost_center ON phc.fi(cost_center)')
        conn.commit()
        print("      [OK] Index created")
        
        # 6. Create index on 2years_fi.cost_center
        print("\n[6/6] Creating index: idx_2years_fi_cost_center...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_cost_center ON phc."2years_fi"(cost_center)')
        conn.commit()
        print("      [OK] Index created")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print("[OK] Foreign keys added:")
        print("     - phc.fi.invoice_id -> phc.ft.invoice_id (CASCADE)")
        print("     - phc.2years_fi.invoice_id -> phc.2years_ft.invoice_id (CASCADE)")
        print("\n[OK] Indexes created:")
        print("     - idx_fi_invoice_id")
        print("     - idx_2years_fi_invoice_id")
        print("     - idx_fi_cost_center")
        print("     - idx_2years_fi_cost_center")
        print("\n[OK] Referential integrity is now enforced!")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to add constraints: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()
        print("\n[OK] Connection closed")

if __name__ == "__main__":
    main()

