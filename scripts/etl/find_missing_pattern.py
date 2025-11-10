"""
Diagnostic helper to analyze recent 'Encomenda a Fornecedor' documents.
Checks daily counts, sequential gaps, sync lag, and a 7-day distribution.
"""

import os
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


def _connect_supabase():
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


def investigate_missing_pattern():
    """Find patterns in what might appear as missing documents."""
    conn = _connect_supabase()
    cursor = conn.cursor()

    print("=== ENCOMENDA A FORNECEDOR ANALYSIS ===\n")

    # 1. Check today's documents
    cursor.execute(
        """
        SELECT COUNT(*) AS count_today, MAX(document_number) AS latest_num
        FROM phc.bo
        WHERE document_type = 'Encomenda a Fornecedor'
          AND document_date = CURRENT_DATE
        """
    )
    today_count, latest_num = cursor.fetchone()
    print(f"Today's Encomenda documents: {today_count}")
    print(f"Latest document number today: {latest_num or 'N/A'}\n")

    # 2. Check for gaps in document numbers (recent window)
    cursor.execute(
        """
        WITH numbered_docs AS (
            SELECT document_number::integer AS doc_num
            FROM phc.bo
            WHERE document_type = 'Encomenda a Fornecedor'
              AND document_date >= CURRENT_DATE - INTERVAL '14 days'
              AND document_number ~ '^[0-9]+$'
        ),
        number_range AS (
            SELECT generate_series(
                (SELECT MIN(doc_num) FROM numbered_docs),
                (SELECT MAX(doc_num) FROM numbered_docs)
            ) AS expected_num
        )
        SELECT expected_num
        FROM number_range
        WHERE expected_num NOT IN (SELECT doc_num FROM numbered_docs)
        ORDER BY expected_num
        LIMIT 50
        """
    )
    gaps = cursor.fetchall()
    if gaps:
        print("Missing document numbers (gaps in the recent sequence):")
        for gap in gaps:
            print(f"  - {gap[0]}")
        print()
    else:
        print("No gaps found in recent document number sequence\n")

    # 3. Check sync lag
    cursor.execute(
        """
        SELECT
            MAX(document_date) AS latest_doc_date,
            NOW() AS current_time,
            AGE(NOW(), MAX(document_date)) AS sync_lag
        FROM phc.bo
        WHERE document_type = 'Encomenda a Fornecedor'
        """
    )
    latest_doc_date, current_time, sync_lag = cursor.fetchone()
    print(f"Latest Encomenda document date: {latest_doc_date}")
    print(f"Current time: {current_time}")
    print(f"Potential sync lag: {sync_lag}\n")

    # 4. Distribution by date for the last week
    cursor.execute(
        """
        SELECT
            document_date AS doc_date,
            COUNT(*) AS count,
            MIN(document_number) AS first_num,
            MAX(document_number) AS last_num
        FROM phc.bo
        WHERE document_type = 'Encomenda a Fornecedor'
          AND document_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY document_date
        ORDER BY doc_date DESC
        """
    )

    print("Last 7 days distribution:")
    for doc_date, count, first_num, last_num in cursor.fetchall():
        print(f"  {doc_date}: {count} docs (#{first_num} to #{last_num})")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    try:
        investigate_missing_pattern()
    except psycopg2.Error as err:
        print(f"[ERROR] Database issue: {err}")
    except Exception as exc:
        print(f"[ERROR] Unexpected issue: {exc}")

