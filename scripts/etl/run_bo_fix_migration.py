# -*- coding: utf-8 -*-
"""
Run the BO duplicate fix migration
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

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

def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            dbname=os.getenv("PG_DB"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            port=os.getenv("PG_PORT", "5432")
        )
        return conn
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

def main():
    print("=" * 80)
    print("RUNNING BO DUPLICATE FIX MIGRATION")
    print("=" * 80)

    # Read migration file
    migration_file = PROJECT_ROOT / "supabase" / "migrations" / "20251031_fix_bo_duplicate_records.sql"

    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)

    print(f"\n📄 Reading migration: {migration_file.name}")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()

    # Connect and execute
    print("🔌 Connecting to Supabase...")
    conn = get_supabase_connection()
    print("✅ Connected\n")

    cursor = conn.cursor()

    try:
        print("🔧 Executing migration...")
        print("-" * 80)

        # Execute the migration
        cursor.execute(sql)
        conn.commit()

        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print("\n" + "=" * 80)
        print("❌ MIGRATION FAILED")
        print("=" * 80)
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

    print("\n💡 Run check_duplicates.py to verify the fix")

if __name__ == "__main__":
    main()
