#!/usr/bin/env python3
"""
Post-Sync View Recreation and Constraint Management Script
===========================================================
Recreates custom database views and enforces foreign key constraints after ETL sync completes.
Run automatically after full/incremental syncs to ensure views and referential integrity.

Tasks performed:
1. Recreate views:
   - phc.folha_obra_with_orcamento (combines work orders with budgets)
   
2. Add FI foreign key constraints:
   - phc.fi.invoice_id -> phc.ft.invoice_id (CASCADE)
   - phc.2years_fi.invoice_id -> phc.2years_ft.invoice_id (CASCADE)
   
3. Create indexes for performance:
   - idx_fi_invoice_id, idx_fi_cost_center
   - idx_2years_fi_invoice_id, idx_2years_fi_cost_center

Note: Historical views (bo_historical_monthly, ft_historical_monthly, and their normalized variants)
have been removed as analytics now uses the get_department_rankings_ytd() RPC function.
"""

import os
import sys
from pathlib import Path

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from dotenv import load_dotenv
import psycopg2

# Load environment variables from .env.local
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [
    PROJECT_ROOT / ".env.local",
    PROJECT_ROOT / ".env",
]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"✅ Loaded env from {env_path.name}")
        break
else:
    load_dotenv()

def get_supabase_connection():
    """Create connection to Supabase PostgreSQL"""
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
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)

def recreate_folha_obra_with_orcamento_view(conn):
    """
    Recreate phc.folha_obra_with_orcamento view
    
    This view combines:
    - Work orders (folha de obra) from phc.bo
    - Budgets (orcamentos) from phc.bo  
    - Customer info from phc.cl
    - Line items count from phc.bi
    
    Matching logic:
    - Orçamento is matched to Folha de Obra by:
      1. Same customer_id
      2. Same total_value
      3. If multiple matches, select the one with closest document_date
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.folha_obra_with_orcamento CASCADE;
    
    -- Recreate view
    -- Note: BO table contains BOTH folha de obra AND orcamento records
    -- We match them by customer_id, total_value, and closest document_date
    CREATE VIEW phc.folha_obra_with_orcamento AS
    WITH orcamento_with_lines AS (
        SELECT 
            orc.document_id,
            orc.document_number,
            orc.document_date,
            orc.document_type,
            orc.customer_id,
            orc.total_value,
            COUNT(DISTINCT orc_bi.line_id) AS orcamento_lines
        FROM phc.bo orc
        LEFT JOIN phc.bi orc_bi ON orc.document_id = orc_bi.document_id
        WHERE orc.document_type = 'Orçamento'
        GROUP BY 
            orc.document_id,
            orc.document_number,
            orc.document_date,
            orc.document_type,
            orc.customer_id,
            orc.total_value
    ),
    matched_orcamento AS (
        SELECT DISTINCT ON (fo.document_id)
            fo.document_id,
            orc.document_id AS orcamento_id,
            orc.document_number AS orcamento_number,
            orc.document_date AS orcamento_date,
            orc.total_value AS orcamento_value,
            orc.orcamento_lines,
            ABS(orc.document_date - fo.document_date) AS date_diff_days
        FROM phc.bo fo
        LEFT JOIN orcamento_with_lines orc ON 
            orc.customer_id = fo.customer_id 
            AND orc.total_value = fo.total_value
            AND orc.document_id != fo.document_id
        WHERE fo.document_type = 'Folha de Obra'
        ORDER BY fo.document_id, date_diff_days ASC
    )
    SELECT 
        -- Folha de Obra fields
        fo.document_id AS folha_obra_id,
        fo.document_number AS folha_obra_number,
        fo.document_date AS folha_obra_date,
        fo.last_delivery_date AS folha_obra_delivery_date,
        
        -- Customer info
        fo.customer_id,
        cl.customer_name,
        
        -- Folha de Obra values
        fo.total_value AS folha_obra_value,
        fo.observacoes,
        fo.nome_trabalho,
        COUNT(DISTINCT bi.line_id) AS folha_obra_lines,
        
        -- Orcamento fields (matched by customer_id, total_value, and closest date)
        mo.orcamento_id,
        mo.orcamento_number,
        mo.orcamento_date,
        mo.orcamento_value,
        mo.orcamento_lines,
        
        -- Calculated fields
        CASE 
            WHEN mo.orcamento_date IS NOT NULL AND fo.document_date IS NOT NULL 
            THEN (fo.document_date - mo.orcamento_date)::integer 
            ELSE NULL 
        END AS days_between_quote_and_work,
        CASE 
            WHEN mo.orcamento_date IS NOT NULL AND fo.last_delivery_date IS NOT NULL 
            THEN (fo.last_delivery_date - mo.orcamento_date)::integer 
            ELSE NULL 
        END AS days_between_quote_and_delivery,
        CASE 
            WHEN mo.orcamento_value IS NOT NULL 
            THEN (fo.total_value - mo.orcamento_value) 
            ELSE NULL 
        END AS value_difference
    
    FROM phc.bo fo
    LEFT JOIN phc.cl cl ON fo.customer_id = cl.customer_id
    LEFT JOIN phc.bi bi ON fo.document_id = bi.document_id
    LEFT JOIN matched_orcamento mo ON fo.document_id = mo.document_id
    WHERE fo.document_number IS NOT NULL
      AND fo.document_type = 'Folha de Obra'
    GROUP BY 
        fo.document_id,
        fo.document_number,
        fo.document_date,
        fo.last_delivery_date,
        fo.customer_id,
        cl.customer_name,
        fo.total_value,
        fo.observacoes,
        fo.nome_trabalho,
        mo.orcamento_id,
        mo.orcamento_number,
        mo.orcamento_date,
        mo.orcamento_value,
        mo.orcamento_lines;
    
    -- Grant permissions
    GRANT SELECT ON phc.folha_obra_with_orcamento TO authenticated;
    GRANT SELECT ON phc.folha_obra_with_orcamento TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.folha_obra_with_orcamento recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate view: {e}")
        conn.rollback()
        return False

# REMOVED: recreate_v_bo_current_year_monthly_salesperson_norm
# REMOVED: recreate_v_ft_current_year_monthly_salesperson_norm
# These views are no longer used. Analytics now uses get_department_rankings_ytd() RPC function.

def add_fi_foreign_keys_and_indexes(conn):
    """
    Add foreign key constraints and indexes for FI tables
    
    This ensures referential integrity between FI (invoice line items) and FT (invoices)
    and improves query performance with indexes.
    """
    cursor = conn.cursor()
    all_success = True
    
    try:
        # 1. Add FK for fi table (if not exists)
        try:
            cursor.execute('''
                ALTER TABLE phc.fi 
                ADD CONSTRAINT fk_fi_invoice 
                FOREIGN KEY (invoice_id) 
                REFERENCES phc.ft(invoice_id) 
                ON DELETE CASCADE
            ''')
            conn.commit()
            print("   [OK] FK added: phc.fi -> phc.ft")
        except Exception:
            conn.rollback()
            # FK already exists, skip
            pass
        
        # 2. Add FK for 2years_fi table (if not exists)
        try:
            cursor.execute('''
                ALTER TABLE phc."2years_fi" 
                ADD CONSTRAINT fk_2years_fi_invoice 
                FOREIGN KEY (invoice_id) 
                REFERENCES phc."2years_ft"(invoice_id) 
                ON DELETE CASCADE
            ''')
            conn.commit()
            print("   [OK] FK added: phc.2years_fi -> phc.2years_ft")
        except Exception:
            conn.rollback()
            # FK already exists, skip
            pass
        
        # 3. Create indexes (IF NOT EXISTS prevents errors)
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fi_invoice_id ON phc.fi(invoice_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fi_cost_center ON phc.fi(cost_center)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_invoice_id ON phc."2years_fi"(invoice_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_2years_fi_cost_center ON phc."2years_fi"(cost_center)')
        conn.commit()
        print("   [OK] Indexes created/verified")
        
        cursor.close()
        return True
        
    except Exception as e:
        print(f"   [WARN] FI constraints/indexes: {e}")
        conn.rollback()
        return False

def main():
    """Main execution"""
    print("🔄 Recreating post-sync database views and constraints...")
    
    # Connect to Supabase
    conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Recreate views
    view_success = recreate_folha_obra_with_orcamento_view(conn)
    
    # Add FI foreign keys and indexes
    print("\n🔗 Adding FI foreign keys and indexes...")
    fk_success = add_fi_foreign_keys_and_indexes(conn)
    
    # Close connection
    conn.close()
    
    # Exit with appropriate code
    if view_success and fk_success:
        print("\n✅ All post-sync tasks completed successfully")
        print("__VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    elif view_success:
        print("\n⚠️ View created but FI constraints had warnings")
        print("__VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    else:
        print(f"\n❌ Post-sync tasks failed")
        print("__VIEW_RECREATION_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

