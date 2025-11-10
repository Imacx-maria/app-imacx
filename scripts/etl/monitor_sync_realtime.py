"""
Monitor new 'Encomenda a Fornecedor' documents appearing in Supabase in near real-time.
Run during business hours to track arrival cadence after PHC sync jobs.
"""

import os
import time
from datetime import datetime
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


def _connect():
    load_dotenv()
    host = os.getenv("SUPABASE_HOST") or os.getenv("PG_HOST")
    database = os.getenv("SUPABASE_DB") or os.getenv("PG_DB")
    user = os.getenv("SUPABASE_USER") or os.getenv("PG_USER")
    password = os.getenv("SUPABASE_PASSWORD") or os.getenv("PG_PASSWORD")
    port = os.getenv("SUPABASE_PORT") or os.getenv("PG_PORT") or "5432"

    if not all([host, database, user, password]):
        raise RuntimeError(
            "Database credentials missing. Ensure SUPABASE_* or PG_* variables are set."
        )

    return psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=port,
    )


def monitor_new_documents(
    poll_interval_seconds: int = 60, max_iterations: int | None = None
):
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT COUNT(*)
        FROM phc.bo
        WHERE document_type = 'Encomenda a Fornecedor'
          AND document_date = CURRENT_DATE
        """
    )
    initial_count = cursor.fetchone()[0]
    last_count = initial_count

    print(f"Starting monitor - current count for today: {initial_count}")
    print("Monitoring for new documents (Ctrl+C to stop)...\n")

    iterations = 0

    try:
        while True:
            time.sleep(poll_interval_seconds)
            cursor.execute(
                """
                SELECT COUNT(*) AS total, MAX(document_number) AS latest
                FROM phc.bo
                WHERE document_type = 'Encomenda a Fornecedor'
                  AND document_date = CURRENT_DATE
                """
            )
            current_count, latest_num = cursor.fetchone()

            if current_count > last_count:
                diff = current_count - last_count
                print(
                    f"[{datetime.now():%H:%M:%S}] +{diff} new documents! "
                    f"Latest: #{latest_num} (total today: {current_count})"
                )

                cursor.execute(
                    """
                    SELECT document_number, total_value
                    FROM phc.bo
                    WHERE document_type = 'Encomenda a Fornecedor'
                      AND document_date = CURRENT_DATE
                    ORDER BY document_number::integer DESC
                    LIMIT %s
                    """,
                    (diff,),
                )
                for doc_number, total_value in cursor.fetchall():
                    print(f"  → #{doc_number}: €{total_value}")

                last_count = current_count
            else:
                print(
                    f"[{datetime.now():%H:%M:%S}] No new documents "
                    f"(still {current_count})"
                )
            iterations += 1
            if max_iterations is not None and iterations >= max_iterations:
                print("Reached max iterations; stopping monitor.")
                break
    except KeyboardInterrupt:
        print("\nMonitoring stopped.")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    try:
        max_iter = os.getenv("MONITOR_MAX_ITERATIONS")
        monitor_new_documents(
            poll_interval_seconds=int(os.getenv("MONITOR_INTERVAL", "60")),
            max_iterations=int(max_iter) if max_iter else None,
        )
    except psycopg2.Error as err:
        print(f"[ERROR] Database issue: {err}")
    except Exception as exc:
        print(f"[ERROR] Unexpected issue: {exc}")

