#!/usr/bin/env python3
"""
Post-Sync View Recreation Script
==================================
Recreates custom database views after ETL sync completes.
Run automatically after full/incremental syncs to ensure views exist.

Views recreated:
- phc.folha_obra_with_orcamento (combines work orders with budgets)
"""

import os
import sys
from pathlib import Path
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
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.folha_obra_with_orcamento CASCADE;
    
    -- Recreate view
    -- Note: BO table contains BOTH folha de obra AND orcamento records
    -- The 'origin' field links FO records to their source budget number
    CREATE VIEW phc.folha_obra_with_orcamento AS
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
        
        -- Orcamento fields (budget number from origin field)
        NULL::text AS orcamento_id,
        fo.origin AS orcamento_number,
        NULL::date AS orcamento_date,
        NULL::numeric AS orcamento_value,
        NULL::bigint AS orcamento_lines,
        
        -- Calculated fields
        NULL::integer AS days_between_quote_and_work,
        NULL::integer AS days_between_quote_and_delivery,
        NULL::numeric AS value_difference
    
    FROM phc.bo fo
    LEFT JOIN phc.cl cl ON fo.customer_id = cl.customer_id
    LEFT JOIN phc.bi bi ON fo.document_id = bi.document_id
    WHERE fo.document_number IS NOT NULL
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
        fo.origin;
    
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

def main():
    """Main execution"""
    print("🔄 Recreating post-sync database views...")
    
    # Connect to Supabase
    conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Recreate views
    success = recreate_folha_obra_with_orcamento_view(conn)
    
    # Close connection
    conn.close()
    
    # Exit with appropriate code
    if success:
        print("✅ All views recreated successfully")
        print("__VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    else:
        print("❌ View recreation failed")
        print("__VIEW_RECREATION_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

