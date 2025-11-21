"""
Apply Quote RPC Migration using direct Postgres connection
Fixes permission denied error for 'bo' table access
"""

import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

def apply_migration():
    print("🔐 Applying Quote RPC Migration...\n")

    # Get Postgres connection details
    pg_host = os.getenv('PG_HOST')
    pg_db = os.getenv('PG_DB')
    pg_user = os.getenv('PG_USER')
    pg_password = os.getenv('PG_PASSWORD')
    pg_port = os.getenv('PG_PORT', '5432')

    if not all([pg_host, pg_db, pg_user, pg_password]):
        print("❌ Missing Postgres credentials in .env.local")
        return False

    # Read migration file
    migration_path = Path(__file__).parent.parent / 'supabase' / 'migrations' / '20251121000003_add_get_quotes_by_numbers_rpc.sql'

    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False

    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print("📄 Migration file loaded")
    print("📝 Connecting to Postgres...\n")

    try:
        # Connect to Postgres
        conn = psycopg2.connect(
            host=pg_host,
            database=pg_db,
            user=pg_user,
            password=pg_password,
            port=pg_port,
            sslmode='require'
        )
        conn.autocommit = True
        cursor = conn.cursor()

        print("✅ Connected to Postgres")
        print("📝 Executing migration...\n")

        # Execute the SQL
        cursor.execute(sql)

        print("✅ Migration executed successfully!\n")

        # Test the function
        print("📊 Testing new function...")
        cursor.execute("""
            SELECT * FROM get_quotes_by_numbers(ARRAY['0001', '3957'])
        """)

        results = cursor.fetchall()
        print(f"✅ Test passed! Found {len(results)} quotes")

        if results:
            print(f"Sample: document_number={results[0][1]}, document_date={results[0][2]}")

        cursor.close()
        conn.close()

        print("\n🎉 Migration completed successfully!")
        return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == '__main__':
    success = apply_migration()
    exit(0 if success else 1)
