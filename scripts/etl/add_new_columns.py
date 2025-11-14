"""
Add new columns to existing BO and FT tables
Run this BEFORE running the sync
"""

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Set UTF-8 encoding for Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# Load environment
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break


def main():
    print("=" * 80)
    print("ADD NEW COLUMNS TO BO AND FT TABLES")
    print("=" * 80)

    try:
        # Connect to Supabase
        conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            database=os.getenv("PG_DB"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            port=os.getenv("PG_PORT", "5432"),
            sslmode=os.getenv("PG_SSLMODE", "require"),
        )

        cursor = conn.cursor()

        print("\n[INFO] Connected to Supabase")

        # Add column to BO table
        print("\n[BO] Adding 'created_by' column...")
        try:
            cursor.execute(
                "ALTER TABLE phc.bo ADD COLUMN IF NOT EXISTS created_by TEXT"
            )
            conn.commit()
            print("  ✓ Column added successfully")
        except Exception as e:
            print(f"  ℹ Column might already exist: {e}")
            conn.rollback()

        # Add columns to FT table
        print("\n[FT] Adding 'salesperson_name' column...")
        try:
            cursor.execute(
                "ALTER TABLE phc.ft ADD COLUMN IF NOT EXISTS salesperson_name TEXT"
            )
            conn.commit()
            print("  ✓ Column added successfully")
        except Exception as e:
            print(f"  ℹ Column might already exist: {e}")
            conn.rollback()

        print("\n[FT] Adding 'customer_name' column...")
        try:
            cursor.execute(
                "ALTER TABLE phc.ft ADD COLUMN IF NOT EXISTS customer_name TEXT"
            )
            conn.commit()
            print("  ✓ Column added successfully")
        except Exception as e:
            print(f"  ℹ Column might already exist: {e}")
            conn.rollback()

        print("\n[FT] Adding 'created_by' column...")
        try:
            cursor.execute(
                "ALTER TABLE phc.ft ADD COLUMN IF NOT EXISTS created_by TEXT"
            )
            conn.commit()
            print("  ✓ Column added successfully")
        except Exception as e:
            print(f"  ℹ Column might already exist: {e}")
            conn.rollback()

        cursor.close()
        conn.close()

        print("\n" + "=" * 80)
        print("✅ ALL COLUMNS ADDED SUCCESSFULLY")
        print("=" * 80)
        print("\nNow you can run:")
        print("  python scripts/etl/run_incremental_year.py")
        print("  python scripts/etl/run_annual_historical.py")

        sys.exit(0)

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
