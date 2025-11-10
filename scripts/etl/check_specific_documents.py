"""
Check whether specific document numbers exist within 'Encomenda a Fornecedor'.
Update the `missing_docs` list with values reported by colleagues before running.
"""

import os
from typing import Iterable
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


def check_specific_documents(document_numbers: Iterable[str]):
    conn = _connect()
    cursor = conn.cursor()

    print("=== CHECKING SPECIFIC DOCUMENTS ===\n")

    for doc_num in document_numbers:
        doc_num = str(doc_num).strip()
        if not doc_num:
            continue

        cursor.execute(
            """
            SELECT
                document_id,
                document_number,
                document_type,
                document_date,
                total_value
            FROM phc.bo
            WHERE document_type = 'Encomenda a Fornecedor'
              AND document_number = %s
            """,
            (doc_num,),
        )
        result = cursor.fetchone()

        if result:
            document_id, document_number, document_type, document_date, total_value = result
            print(f"✓ Found #{document_number}:")
            print(f"  Date: {document_date}")
            print(f"  Type: {document_type}")
            print(f"  Value: €{total_value}")
            print(f"  ID: {document_id}\n")
            continue

        print(f"✗ NOT FOUND: #{doc_num}")
        cursor.execute(
            """
            SELECT document_type, document_date
            FROM phc.bo
            WHERE document_number = %s
            LIMIT 1
            """,
            (doc_num,),
        )
        other_type = cursor.fetchone()
        if other_type:
            print(
                f"  Note: exists as type '{other_type[0]}' dated {other_type[1]}.\n"
            )
        else:
            print("  No matching document with any type.\n")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    # TODO: populate this list with document numbers provided by colleagues.
    missing_docs = [
        # "1234",
        # "1235",
    ]

    if missing_docs:
        try:
            check_specific_documents(missing_docs)
        except psycopg2.Error as err:
            print(f"[ERROR] Database issue: {err}")
        except Exception as exc:
            print(f"[ERROR] Unexpected issue: {exc}")
    else:
        print(
            "Please populate `missing_docs` with document numbers to verify "
            "and re-run this script."
        )

