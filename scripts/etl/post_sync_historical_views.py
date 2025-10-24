#!/usr/bin/env python3
"""
Post-Sync Historical View Recreation Script
============================================
Recreates historical database views after annual historical sync completes.
Run automatically after annual historical sync to ensure views exist.

Views recreated:
- phc.v_bo_current_year_monthly_salesperson (current year BO monthly by salesperson)
- phc.v_ft_current_year_monthly_salesperson (current year FT monthly by salesperson)

Note: folha_obra_with_orcamento is NOT recreated (uses current tables)
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

def recreate_v_bo_current_year_monthly_salesperson(conn):
    """
    Recreate phc.v_bo_current_year_monthly_salesperson view
    
    This view aggregates current year BO (budgets/work orders) data by:
    - Year
    - Month
    - Department (salesperson/team)
    - Document type
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.v_bo_current_year_monthly_salesperson CASCADE;
    
    -- Recreate view for current year BO monthly aggregation
    CREATE VIEW phc.v_bo_current_year_monthly_salesperson AS
    SELECT 
        EXTRACT(YEAR FROM document_date)::INTEGER AS year,
        EXTRACT(MONTH FROM document_date)::INTEGER AS month,
        COALESCE(department, 'UNKNOWN') AS department,
        COALESCE(document_type, 'UNKNOWN') AS document_type,
        SUM(total_value) AS total_value,
        COUNT(*) AS document_count
    FROM phc.bo
    WHERE document_date >= DATE_TRUNC('year', CURRENT_DATE)
        AND document_date < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
    GROUP BY 
        EXTRACT(YEAR FROM document_date),
        EXTRACT(MONTH FROM document_date),
        department,
        document_type
    ORDER BY year, month, department;
    
    -- Grant permissions
    GRANT SELECT ON phc.v_bo_current_year_monthly_salesperson TO authenticated;
    GRANT SELECT ON phc.v_bo_current_year_monthly_salesperson TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.v_bo_current_year_monthly_salesperson recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate BO view: {e}")
        conn.rollback()
        return False

def recreate_v_ft_current_year_monthly_salesperson(conn):
    """
    Recreate phc.v_ft_current_year_monthly_salesperson view
    
    This view aggregates current year FT (invoices/credit notes) data by:
    - Year
    - Month
    - Department (salesperson/team)
    - Document type
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.v_ft_current_year_monthly_salesperson CASCADE;
    
    -- Recreate view for current year FT monthly aggregation
    CREATE VIEW phc.v_ft_current_year_monthly_salesperson AS
    SELECT 
        EXTRACT(YEAR FROM invoice_date)::INTEGER AS year,
        EXTRACT(MONTH FROM invoice_date)::INTEGER AS month,
        COALESCE(department, 'UNKNOWN') AS department,
        COALESCE(document_type, 'UNKNOWN') AS document_type,
        SUM(total_value) AS total_value,
        COUNT(*) AS document_count
    FROM phc.ft
    WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
        AND invoice_date < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
    GROUP BY 
        EXTRACT(YEAR FROM invoice_date),
        EXTRACT(MONTH FROM invoice_date),
        department,
        document_type
    ORDER BY year, month, department;
    
    -- Grant permissions
    GRANT SELECT ON phc.v_ft_current_year_monthly_salesperson TO authenticated;
    GRANT SELECT ON phc.v_ft_current_year_monthly_salesperson TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.v_ft_current_year_monthly_salesperson recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate FT view: {e}")
        conn.rollback()
        return False

def main():
    """Main execution"""
    print("🔄 Recreating historical database views...")
    
    # Connect to Supabase
    conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Recreate views
    success_bo = recreate_v_bo_current_year_monthly_salesperson(conn)
    success_ft = recreate_v_ft_current_year_monthly_salesperson(conn)
    
    # Close connection
    conn.close()
    
    # Exit with appropriate code
    if success_bo and success_ft:
        print("✅ All historical views recreated successfully")
        print("__HISTORICAL_VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    else:
        print("❌ Historical view recreation failed")
        print("__HISTORICAL_VIEW_RECREATION_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

