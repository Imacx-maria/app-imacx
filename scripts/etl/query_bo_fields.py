"""
Query PHC BO table to find all fields and identify the document creator field
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
        if not conn_str:
            print("[ERROR] MSSQL_DIRECT_CONNECTION not found in environment")
            sys.exit(1)

        print("[INFO] Connecting to PHC database...")
        conn = pyodbc.connect(conn_str, timeout=30)
        cursor = conn.cursor()

        # First, get all column names from the BO table
        print("\n[INFO] Fetching column metadata from BO table...")
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'bo'
            ORDER BY ORDINAL_POSITION
        """)

        columns = cursor.fetchall()
        print(f"\n[INFO] Found {len(columns)} columns in BO table")
        print("\n" + "=" * 80)
        print("COLUMN METADATA:")
        print("=" * 80)
        for col_name, data_type, max_length in columns:
            length_info = f"({max_length})" if max_length else ""
            print(f"  {col_name:30} {data_type}{length_info}")

        # Now query 10 sample rows with fields that might contain user/creator info
        # Looking for fields like: userstamp, user, operador, tecnico, nome2, etc.
        print("\n" + "=" * 80)
        print("SAMPLE DATA (10 rows) - Looking for creator/user fields:")
        print("=" * 80)

        # Build a query with likely candidate fields
        candidate_fields = [
            "bostamp",
            "obrano",
            "dataobra",
            "nmdos",
            "nome2",
            "userstamp",
            "userno",
            "ousrinis",
            "ousrdata",
            "ousrhora",
            "userimpresso",
            "tecnico",
            "vendedor",
            "nome",
            "obranome",
        ]

        # Check which fields actually exist
        existing_fields = [col[0].lower() for col in columns]
        valid_fields = []
        for field in candidate_fields:
            if field.lower() in existing_fields:
                valid_fields.append(field)

        if not valid_fields:
            print("[ERROR] None of the candidate fields exist in the table")
            sys.exit(1)

        query = f"SELECT TOP 10 {', '.join([f'[{f}]' for f in valid_fields])} FROM [bo] ORDER BY dataobra DESC"
        print(f"\n[QUERY] {query}\n")

        cursor.execute(query)
        rows = cursor.fetchall()

        # Print header
        print("  | " + " | ".join([f"{f:20}" for f in valid_fields]))
        print("  " + "-" * (len(valid_fields) * 24))

        # Print rows
        for row in rows:
            values = []
            for val in row:
                if val is None:
                    values.append("NULL".ljust(20))
                else:
                    str_val = str(val)[:20]
                    values.append(str_val.ljust(20))
            print("  | " + " | ".join(values))

        print("\n" + "=" * 80)
        print("FIELDS THAT MIGHT BE THE CREATOR/USER:")
        print("=" * 80)
        user_related = [
            f
            for f in valid_fields
            if any(
                keyword in f.lower()
                for keyword in ["user", "usr", "tecnico", "vendedor", "nome2"]
            )
        ]
        for field in user_related:
            print(f"  - {field}")

        cursor.close()
        conn.close()

        print("\n[OK] Query completed successfully")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
