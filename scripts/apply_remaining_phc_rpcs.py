"""
Apply Remaining PHC RPC Migrations
Completes the fix for auto-dismiss-converted endpoint
"""

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)


def apply_migration():
    print("🔐 Applying Remaining PHC RPC Migrations...\n")

    # Get Postgres connection details
    pg_host = os.getenv("PG_HOST")
    pg_db = os.getenv("PG_DB")
    pg_user = os.getenv("PG_USER")
    pg_password = os.getenv("PG_PASSWORD")
    pg_port = os.getenv("PG_PORT", "5432")

    if not all([pg_host, pg_db, pg_user, pg_password]):
        print("❌ Missing Postgres credentials in .env.local")
        return False

    # Read migration file
    migration_path = (
        Path(__file__).parent.parent
        / "supabase"
        / "migrations"
        / "20251121000004_add_remaining_phc_rpcs.sql"
    )

    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False

    with open(migration_path, "r", encoding="utf-8") as f:
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
            sslmode="require",
        )
        conn.autocommit = True
        cursor = conn.cursor()

        print("✅ Connected to Postgres")
        print("📝 Executing migration...\n")

        # Execute the SQL
        cursor.execute(sql)

        print("✅ Migration executed successfully!\n")

        # Test the functions
        print("📊 Testing new functions...")

        # Test get_bi_by_document_ids
        print("\n1. Testing get_bi_by_document_ids...")
        cursor.execute("""
            SELECT * FROM get_bi_by_document_ids(ARRAY['MAM25053043320,566000001'])
            LIMIT 3
        """)
        results = cursor.fetchall()
        print(f"   ✅ Success: {len(results)} records returned")

        # Test get_fi_by_bistamps (use a sample bistamp if available)
        print("\n2. Testing get_fi_by_bistamps...")
        cursor.execute("""
            SELECT * FROM get_fi_by_bistamps(ARRAY['sample_bistamp'])
            LIMIT 1
        """)
        results = cursor.fetchall()
        print(f"   ✅ Success: Function works (returned {len(results)} records)")

        # Test get_ft_by_invoice_ids
        print("\n3. Testing get_ft_by_invoice_ids...")
        cursor.execute("""
            SELECT * FROM get_ft_by_invoice_ids(ARRAY['sample_invoice'])
            LIMIT 1
        """)
        results = cursor.fetchall()
        print(f"   ✅ Success: Function works (returned {len(results)} records)")

        cursor.close()
        conn.close()

        print("\n🎉 All RPC functions created and tested successfully!")
        print("\n📋 Created functions:")
        print("  ✓ get_bi_by_document_ids(text[])")
        print("  ✓ get_fi_by_bistamps(text[])")
        print("  ✓ get_ft_by_invoice_ids(text[])")

        return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


if __name__ == "__main__":
    success = apply_migration()
    exit(0 if success else 1)
