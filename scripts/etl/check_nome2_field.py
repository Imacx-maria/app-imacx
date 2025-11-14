"""
Check NOME2 field in PHC to understand what it represents
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

        # Check if there are any records with NOME2 populated
        print("[INFO] Checking NOME2 field usage in BO table...")
        cursor.execute("""
            SELECT TOP 20
                [obrano],
                [dataobra],
                [nmdos],
                [nome],
                [nome2],
                [ousrinis],
                [userimpresso]
            FROM [bo]
            WHERE [nome2] IS NOT NULL AND [nome2] <> ''
            ORDER BY [dataobra] DESC
        """)

        rows = cursor.fetchall()

        if rows:
            print(f"\n[FOUND] {len(rows)} records with NOME2 populated:\n")
            print(
                "  Doc#    | Date       | Type                 | Nome (Customer)      | NOME2 (?)            | Creator  | Printed By"
            )
            print("  " + "-" * 140)
            for row in rows:
                obrano, dataobra, nmdos, nome, nome2, ousrinis, userimpresso = row
                print(
                    f"  {str(obrano):7} | {str(dataobra)[:10]} | {str(nmdos)[:20]:20} | {str(nome)[:20]:20} | {str(nome2)[:20]:20} | {str(ousrinis):8} | {str(userimpresso or '')[:20]}"
                )
        else:
            print("\n[INFO] NOME2 field is empty in all records (or doesn't exist)")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
