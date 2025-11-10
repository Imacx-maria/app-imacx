"""
Inspect the latest sync metadata for PHC tables via `phc.sync_watermarks`.
Helps highlight stale syncs or lagging watermarks.
"""

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_CANDIDATES = [
    BASE_DIR / ".env.local",
    BASE_DIR / ".env",
    BASE_DIR / "config" / ".env.local",
    BASE_DIR / "config" / ".env",
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break
else:
    load_dotenv()


def check_sync_schedule():
    host = os.getenv("SUPABASE_HOST") or os.getenv("PG_HOST")
    database = os.getenv("SUPABASE_DB") or os.getenv("PG_DB")
    user = os.getenv("SUPABASE_USER") or os.getenv("PG_USER")
    password = os.getenv("SUPABASE_PASSWORD") or os.getenv("PG_PASSWORD")
    port = os.getenv("SUPABASE_PORT") or os.getenv("PG_PORT") or "5432"

    if not all([host, database, user, password]):
        raise RuntimeError(
            "Database credentials missing. Ensure SUPABASE_* or PG_* variables are set."
        )

    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=port,
    )
    cursor = conn.cursor()

    print("=== SYNC SCHEDULE ANALYSIS ===\n")

    cursor.execute(
        """
        SELECT
            table_name,
            watermark,
            last_sync_time,
            AGE(NOW(), last_sync_time) AS time_since_sync
        FROM phc.sync_watermarks
        ORDER BY last_sync_time DESC NULLS LAST
        """
    )

    rows = cursor.fetchall()
    if not rows:
        print("No watermark entries found.")
    else:
        print("Sync Status:")
        for table_name, watermark, last_sync_time, time_since_sync in rows:
            print(
                f"  {table_name}: last sync at {last_sync_time}, "
                f"time since sync {time_since_sync}, watermark {watermark}"
            )

    cursor.close()
    conn.close()


if __name__ == "__main__":
    try:
        check_sync_schedule()
    except psycopg2.Error as err:
        print(f"[ERROR] Database issue: {err}")
    except Exception as exc:
        print(f"[ERROR] Unexpected issue: {exc}")

