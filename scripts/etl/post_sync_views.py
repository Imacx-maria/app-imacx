#!/usr/bin/env python3
"""
Post-Sync View Recreation Script
==================================
Recreates custom database views after ETL sync completes.
Run automatically after full/incremental syncs to ensure views exist.

Views recreated:
- phc.folha_obra_with_orcamento (combines work orders with budgets)
- phc.v_bo_current_year_monthly_salesperson_norm (BO current year - normalized mapping)
- phc.v_ft_current_year_monthly_salesperson_norm (FT current year - normalized mapping)
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

def recreate_v_bo_current_year_monthly_salesperson_norm(conn):
    """
    Recreate phc.v_bo_current_year_monthly_salesperson_norm view
    BO current year with normalized/robust salesperson mapping
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.v_bo_current_year_monthly_salesperson_norm CASCADE;
    
    -- Create view for current year BO with normalized mapping
    CREATE VIEW phc.v_bo_current_year_monthly_salesperson_norm AS
    WITH unm AS (
      SELECT
        department,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(initials,''),         ' ','')), '[^a-z0-9]+', '', 'g')) AS k_initials,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(short_name,''),       ' ','')), '[^a-z0-9]+', '', 'g')) AS k_short,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(full_name,''),        ' ','')), '[^a-z0-9]+', '', 'g')) AS k_full,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(standardized_name,''),' ','')), '[^a-z0-9]+', '', 'g')) AS k_std
      FROM public.user_name_mapping
    )
    SELECT
      EXTRACT(YEAR  FROM b.document_date)::int AS year,
      EXTRACT(MONTH FROM b.document_date)::int AS month,
      b.document_type,
      COUNT(DISTINCT b.document_id)            AS document_count,
      SUM(COALESCE(b.total_value,0))           AS total_value,
      COALESCE(cl.salesperson, 'Unassigned')   AS salesperson,
      COALESCE(u.department, 'Unknown')        AS department
    FROM phc.bo b
    LEFT JOIN phc.cl cl ON cl.customer_id = b.customer_id
    LEFT JOIN LATERAL (
      SELECT department
      FROM unm m
      WHERE LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(cl.salesperson,''),' ','')), '[^a-z0-9]+', '', 'g'))
            IN (m.k_initials, m.k_short, m.k_full, m.k_std)
      LIMIT 1
    ) u ON TRUE
    WHERE EXTRACT(YEAR FROM b.document_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY 1,2,3,6,7;
    
    -- Grant permissions
    GRANT SELECT ON phc.v_bo_current_year_monthly_salesperson_norm TO authenticated;
    GRANT SELECT ON phc.v_bo_current_year_monthly_salesperson_norm TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.v_bo_current_year_monthly_salesperson_norm recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate v_bo_current_year_monthly_salesperson_norm view: {e}")
        conn.rollback()
        return False

def recreate_v_ft_current_year_monthly_salesperson_norm(conn):
    """
    Recreate phc.v_ft_current_year_monthly_salesperson_norm view
    FT current year with normalized/robust salesperson mapping
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.v_ft_current_year_monthly_salesperson_norm CASCADE;
    
    -- Create view for current year FT with normalized mapping
    CREATE VIEW phc.v_ft_current_year_monthly_salesperson_norm AS
    WITH unm AS (
      SELECT
        department,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(initials,''),         ' ','')), '[^a-z0-9]+', '', 'g')) AS k_initials,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(short_name,''),       ' ','')), '[^a-z0-9]+', '', 'g')) AS k_short,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(full_name,''),        ' ','')), '[^a-z0-9]+', '', 'g')) AS k_full,
        LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(standardized_name,''),' ','')), '[^a-z0-9]+', '', 'g')) AS k_std
      FROM public.user_name_mapping
    )
    SELECT
      EXTRACT(YEAR  FROM f.invoice_date)::int  AS year,
      EXTRACT(MONTH FROM f.invoice_date)::int  AS month,
      f.document_type,
      COUNT(DISTINCT f.invoice_id)             AS document_count,
      SUM(COALESCE(f.net_value,0))             AS total_value,
      COALESCE(cl.salesperson, 'Unassigned')   AS salesperson,
      COALESCE(u.department, 'Unknown')        AS department
    FROM phc.ft f
    LEFT JOIN phc.cl cl ON cl.customer_id = f.customer_id
    LEFT JOIN LATERAL (
      SELECT department
      FROM unm m
      WHERE LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(cl.salesperson,''),' ','')), '[^a-z0-9]+', '', 'g'))
            IN (m.k_initials, m.k_short, m.k_full, m.k_std)
      LIMIT 1
    ) u ON TRUE
    WHERE EXTRACT(YEAR FROM f.invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND COALESCE(f.anulado, '') != 'true'
    GROUP BY 1,2,3,6,7;
    
    -- Grant permissions
    GRANT SELECT ON phc.v_ft_current_year_monthly_salesperson_norm TO authenticated;
    GRANT SELECT ON phc.v_ft_current_year_monthly_salesperson_norm TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.v_ft_current_year_monthly_salesperson_norm recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate v_ft_current_year_monthly_salesperson_norm view: {e}")
        conn.rollback()
        return False

def main():
    """Main execution"""
    print("🔄 Recreating post-sync database views...")
    
    # Connect to Supabase
    conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Recreate all views
    results = []
    results.append(("folha_obra_with_orcamento", recreate_folha_obra_with_orcamento_view(conn)))
    results.append(("v_bo_current_year_monthly_salesperson_norm", recreate_v_bo_current_year_monthly_salesperson_norm(conn)))
    results.append(("v_ft_current_year_monthly_salesperson_norm", recreate_v_ft_current_year_monthly_salesperson_norm(conn)))
    
    # Close connection
    conn.close()
    
    # Check results
    all_success = all(success for _, success in results)
    failed_views = [name for name, success in results if not success]
    
    # Exit with appropriate code
    if all_success:
        print("✅ All 3 views recreated successfully")
        print("__VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    else:
        print(f"❌ View recreation failed for: {', '.join(failed_views)}")
        print("__VIEW_RECREATION_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

