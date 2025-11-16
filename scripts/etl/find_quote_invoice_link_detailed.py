"""
Find Quote-Invoice Link by checking line-item relationships

Strategy: Check if FI (invoice lines) or BI (quote lines) have a relationship
that links them together via bostamp/ftstamp or other reference fields.
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


def print_section_header(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(title.center(80))
    print("=" * 80)


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

        print_section_header("LINE-ITEM RELATIONSHIP ANALYSIS")

        # Strategy 1: Check if FI has a bostamp field linking to BO
        print("\n[STRATEGY 1] Check if FI (invoice lines) references BO (quotes)")
        print("-" * 80)

        # Get FI columns
        cursor.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'fi'
            ORDER BY ORDINAL_POSITION
        """)
        fi_columns = [row[0] for row in cursor.fetchall()]

        print(f"\nFI table has {len(fi_columns)} columns")
        print("\nLooking for stamp/reference fields in FI:")
        for col in fi_columns:
            if "stamp" in col.lower() or "ref" in col.lower() or "bo" in col.lower():
                print(f"  ✓ {col}")

        # Check specific invoice line items
        print("\n[TEST] Query FI for Invoice 1190 line items:")
        print("-" * 80)

        query = """
        SELECT fi.ftstamp, fi.ref, fi.design, fi.qtt, fi.preco, fi.talao, fi.bistamp, fi.bino
        FROM fi
        INNER JOIN ft ON fi.ftstamp = ft.ftstamp
        WHERE ft.fno = 1190
        """

        try:
            cursor.execute(query)
            rows = cursor.fetchall()

            if rows:
                print(f"\nFound {len(rows)} line items for Invoice 1190:")
                for row in rows:
                    print(f"\n  ftstamp: {row[0]}")
                    print(f"  ref: {row[1]}")
                    print(f"  design: {row[2]}")
                    print(f"  qtt: {row[3]}")
                    print(f"  preco: {row[4]}")
                    print(f"  talao: {row[5]}")
                    print(
                        f"  bistamp: {row[6] or 'NULL'} ← Check if this links to BI/BO"
                    )
                    print(f"  bino: {row[7] or 'NULL'} ← Could be quote reference")
            else:
                print("  No line items found")
        except Exception as e:
            print(f"  [ERROR] {e}")

        # Strategy 2: Check if BI (quote lines) exists and has document links
        print_section_header("STRATEGY 2: Check BI Table Structure")

        try:
            cursor.execute("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'bi'
                ORDER BY ORDINAL_POSITION
            """)
            bi_columns = [row[0] for row in cursor.fetchall()]

            print(f"\nBI table has {len(bi_columns)} columns")
            print("\nLooking for stamp/reference fields in BI:")
            for col in bi_columns:
                if (
                    "stamp" in col.lower()
                    or "ref" in col.lower()
                    or "ft" in col.lower()
                ):
                    print(f"  ✓ {col}")

            # Check if BI.bistamp can be linked to FI.bistamp
            print("\n[TEST] Query BI for Quote 2332 line items:")
            print("-" * 80)

            query = """
            SELECT bi.bostamp, bi.bistamp, bi.ref, bi.design, bi.qtt, bi.preco
            FROM bi
            INNER JOIN bo ON bi.bostamp = bo.bostamp
            WHERE bo.obrano = 2332
            """

            cursor.execute(query)
            rows = cursor.fetchall()

            if rows:
                print(f"\nFound {len(rows)} line items for Quote 2332:")
                for i, row in enumerate(rows):
                    if i < 5:  # Show first 5
                        print(f"\n  bostamp: {row[0]}")
                        print(f"  bistamp: {row[1]} ← Check if FI.bistamp matches this")
                        print(f"  ref: {row[2]}")
                        print(f"  design: {row[3]}")
                        print(f"  qtt: {row[4]}")
                        print(f"  preco: {row[5]}")

                # Now check if any FI records have matching bistamp
                print(
                    "\n[CROSS-CHECK] Do any FI line items reference these BI.bistamp values?"
                )
                print("-" * 80)

                for row in rows[:3]:  # Check first 3
                    bistamp = row[1]
                    print(f"\nChecking bistamp: {bistamp}")

                    cursor.execute(f"""
                        SELECT fi.ftstamp, ft.fno, fi.ref, fi.design
                        FROM fi
                        INNER JOIN ft ON fi.ftstamp = ft.ftstamp
                        WHERE fi.bistamp = '{bistamp}'
                    """)

                    matches = cursor.fetchall()
                    if matches:
                        for match in matches:
                            print(
                                f"  ✓✓✓ MATCH! Invoice {match[1]} has line with bistamp={bistamp}"
                            )
                            print(f"      ftstamp: {match[0]}")
                            print(f"      ref: {match[2]}")
                            print(f"      design: {match[3]}")
                    else:
                        print(f"  ✗ No FI records with this bistamp")
            else:
                print("  No BI line items found for Quote 2332")

        except Exception as e:
            print(f"  [ERROR] BI table query failed: {e}")

        # Strategy 3: Check if there's a document flow table
        print_section_header("STRATEGY 3: Look for Document Flow/History Tables")

        # Common PHC tables that might track document relationships
        flow_tables = ["bo2", "ft2", "ft3", "fh", "bh", "fl", "df", "do"]

        for table in flow_tables:
            try:
                cursor.execute(f"""
                    SELECT TOP 1 * FROM {table}
                """)
                print(
                    f"  ✓ Table {table} exists (might contain document relationships)"
                )

                # Get columns
                cursor.execute(f"""
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '{table}'
                """)
                cols = [row[0] for row in cursor.fetchall()]
                print(f"    Columns ({len(cols)}): {', '.join(cols[:10])}...")

            except Exception:
                pass  # Table doesn't exist

        # Strategy 4: Direct join attempt - maybe there's a pattern we're missing
        print_section_header("STRATEGY 4: Try to Join FT → FI → BI → BO")

        query = """
        SELECT
            ft.fno AS invoice_no,
            bo.obrano AS quote_no,
            fi.ref AS fi_ref,
            bi.ref AS bi_ref,
            fi.design,
            fi.bistamp
        FROM ft
        INNER JOIN fi ON ft.ftstamp = fi.ftstamp
        INNER JOIN bi ON fi.bistamp = bi.bistamp
        INNER JOIN bo ON bi.bostamp = bo.bostamp
        WHERE ft.fno IN (1190, 1177, 1156)
        """

        try:
            print("\nAttempting join: FT → FI → BI → BO")
            print("-" * 80)
            cursor.execute(query)
            rows = cursor.fetchall()

            if rows:
                print(f"\n✓✓✓ SUCCESS! Found {len(rows)} invoice-quote relationships!")
                print("\nInvoice → Quote mappings:")
                print("-" * 80)

                relationships = {}
                for row in rows:
                    invoice_no = row[0]
                    quote_no = row[1]
                    if invoice_no not in relationships:
                        relationships[invoice_no] = set()
                    relationships[invoice_no].add(quote_no)

                for invoice, quotes in sorted(relationships.items()):
                    print(f"  Invoice {invoice} → Quotes: {sorted(quotes)}")

                # Verify against expected
                print("\nVerification:")
                expected = {1190: 2332, 1177: 2312, 1156: 2290}
                for invoice, expected_quote in expected.items():
                    actual_quotes = relationships.get(invoice, set())
                    if expected_quote in actual_quotes:
                        print(
                            f"  ✓ Invoice {invoice} correctly links to Quote {expected_quote}"
                        )
                    else:
                        print(
                            f"  ✗ Invoice {invoice} does NOT link to expected Quote {expected_quote}"
                        )
                        if actual_quotes:
                            print(f"    Found quotes: {actual_quotes}")

            else:
                print("  ✗ No relationships found via this join path")
        except Exception as e:
            print(f"  [ERROR] Join failed: {e}")

        cursor.close()
        conn.close()

        print("\n[OK] Analysis completed")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
