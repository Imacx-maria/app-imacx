"""
Query PHC FT table to see available fields and sample data
"""

import os
import sys
from pathlib import Path

import pyodbc
from dotenv import load_dotenv

# Load environment
BASE_DIR = Path(__file__).resolve().parents[2]
ENV_CANDIDATES = [
    BASE_DIR / ".env.local",
    BASE_DIR / ".env",
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break


def main():
    try:
        # Connect to PHC
        conn_str = os.getenv("MSSQL_DIRECT_CONNECTION")
        conn = pyodbc.connect(conn_str, timeout=30)
        cursor = conn.cursor()

        # Get column metadata
        print("[INFO] Fetching column metadata from FT table...")
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'ft'
            ORDER BY ORDINAL_POSITION
        """)

        columns = cursor.fetchall()
        print(f"\n[INFO] Found {len(columns)} columns in FT table\n")

        # Query sample data with key fields
        print("=" * 80)
        print("SAMPLE DATA (10 recent invoices):")
        print("=" * 80)

        query = """
        SELECT TOP 10
            [ftstamp],
            [fno],
            [fdata],
            [nmdoc],
            [no],
            [nome],
            [vendnm],
            [ettiliq],
            [anulado],
            [ousrinis],
            [ousrdata],
            [usrinis]
        FROM [ft]
        ORDER BY fdata DESC
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        # Print header
        fields = [
            "ftstamp",
            "fno",
            "fdata",
            "nmdoc",
            "no",
            "nome",
            "vendnm",
            "ettiliq",
            "anulado",
            "ousrinis",
            "ousrdata",
            "usrinis",
        ]
        print("  | " + " | ".join([f"{f:15}" for f in fields]))
        print("  " + "-" * (len(fields) * 18))

        # Print rows
        for row in rows:
            values = []
            for val in row:
                if val is None:
                    values.append("NULL".ljust(15))
                else:
                    str_val = str(val)[:15]
                    values.append(str_val.ljust(15))
            print("  | " + " | ".join(values))

        print("\n" + "=" * 80)
        print("RECOMMENDED FIELDS FOR IMPORT:")
        print("=" * 80)
        print("  - ftstamp (invoice_id) ✓ already imported")
        print("  - fno (invoice_number) ✓ already imported")
        print("  - fdata (invoice_date) ✓ already imported")
        print("  - nmdoc (document_type) ✓ already imported")
        print("  - no (customer_id) ✓ already imported")
        print("  - ettiliq (net_value) ✓ already imported")
        print("  - anulado (cancelled) ✓ already imported")
        print("  - vendnm (salesperson_name) ✓ ADDING NOW")
        print("  - ousrinis (created_by) ← SHOULD WE ADD THIS TOO?")
        print("  - nome (customer_name) ← might be useful for reporting")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

        sys.exit(1)


if __name__ == "__main__":
    main()
