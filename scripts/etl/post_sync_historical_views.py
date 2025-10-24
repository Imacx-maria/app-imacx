#!/usr/bin/env python3
"""
Post-Sync Historical View Recreation Script
============================================
Recreates historical database views after annual historical sync completes.
Run automatically after annual historical sync to ensure views exist.

Views recreated:
- phc.bo_historical_monthly_salesperson (Historical BO monthly - aliases bo_historical_monthly)
- phc.ft_historical_monthly_salesperson (Historical FT monthly - aliases ft_historical_monthly)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

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

def recreate_bo_historical_monthly_salesperson(conn):
    """
    Recreate phc.bo_historical_monthly_salesperson view
    
    This view provides a salesperson/department breakdown by aliasing
    the bo_historical_monthly table (which currently doesn't have department data)
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.bo_historical_monthly_salesperson CASCADE;
    
    -- Create view as alias of bo_historical_monthly with department column
    CREATE VIEW phc.bo_historical_monthly_salesperson AS
    SELECT 
        year,
        month,
        'UNKNOWN' AS department,
        document_type,
        total_value,
        document_count
    FROM phc.bo_historical_monthly;
    
    -- Grant permissions
    GRANT SELECT ON phc.bo_historical_monthly_salesperson TO authenticated;
    GRANT SELECT ON phc.bo_historical_monthly_salesperson TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.bo_historical_monthly_salesperson recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate BO historical salesperson view: {e}")
        conn.rollback()
        return False

def recreate_ft_historical_monthly_salesperson(conn):
    """
    Recreate phc.ft_historical_monthly_salesperson view
    
    This view provides a salesperson/department breakdown by aliasing
    the ft_historical_monthly table (which currently doesn't have department data)
    """
    
    sql = """
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS phc.ft_historical_monthly_salesperson CASCADE;
    
    -- Create view as alias of ft_historical_monthly with department column
    CREATE VIEW phc.ft_historical_monthly_salesperson AS
    SELECT 
        year,
        month,
        'UNKNOWN' AS department,
        document_type,
        total_value,
        document_count
    FROM phc.ft_historical_monthly;
    
    -- Grant permissions
    GRANT SELECT ON phc.ft_historical_monthly_salesperson TO authenticated;
    GRANT SELECT ON phc.ft_historical_monthly_salesperson TO anon;
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        print("✅ View phc.ft_historical_monthly_salesperson recreated successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to recreate FT salesperson view: {e}")
        conn.rollback()
        return False

def main():
    """Main execution"""
    print("🔄 Recreating historical database views...")
    
    # Connect to Supabase
    conn = get_supabase_connection()
    print("✅ Connected to Supabase")
    
    # Recreate all 2 views
    success_bo_hist = recreate_bo_historical_monthly_salesperson(conn)
    success_ft_hist = recreate_ft_historical_monthly_salesperson(conn)
    
    # Close connection
    conn.close()
    
    # Exit with appropriate code
    if success_bo_hist and success_ft_hist:
        print("✅ All 2 historical views recreated successfully")
        print("__HISTORICAL_VIEW_RECREATION_DONE__ success=true")
        sys.exit(0)
    else:
        print("❌ Historical view recreation failed")
        print("__HISTORICAL_VIEW_RECREATION_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

