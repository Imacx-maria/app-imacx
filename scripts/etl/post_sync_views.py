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

