"""
Query PHC Tables to Find Quote Number Fields Linking Invoices to Quotes

This script queries multiple PHC tables to identify which field(s)
contain quote numbers that link invoices to quotes.

Tables checked: FT, BO, BI, FI, FI2, FT2, FT3, FTCC

Verification Cases:
- Invoice 1190 should link to Quote 2332
- Invoice 1177 should link to Quote 2312
- Invoice 1156 should link to Quote 2290
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


def get_all_columns(cursor, table_name):
    """Get all columns from a table"""
    try:
        cursor.execute(f"""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '{table_name}'
            ORDER BY ORDINAL_POSITION
        """)
        return cursor.fetchall()
    except Exception as e:
        print(f"  [ERROR] Could not retrieve columns for {table_name}: {e}")
        return []


def print_section_header(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(title.center(80))
    print("=" * 80)


def check_table_for_quote_links(
    cursor, table_name, invoice_field, join_field=None, join_table=None
):
    """Check if a table contains quote number references for verification invoices"""

    print_section_header(f"TABLE: {table_name}")

    # Get all columns
    columns = get_all_columns(cursor, table_name)
    if not columns:
        print(f"  [SKIP] Table {table_name} not found or inaccessible")
        return

    print(f"\n[INFO] Found {len(columns)} columns in {table_name} table")

    # Look for potential quote reference fields
    print("\nPotential quote reference fields:")
    print("-" * 80)

    potential_fields = []
    for col_name, data_type, max_length in columns:
        length_info = f"({max_length})" if max_length else ""
        # Highlight fields that might contain references
        is_potential = any(
            keyword in col_name.lower()
            for keyword in [
                "ref",
                "doc",
                "obs",
                "bo",
                "orca",
                "numero",
                "livre",
                "texto",
                "obrano",
            ]
        )
        if is_potential:
            print(f"  ✓ {col_name:30} {data_type}{length_info}")
            potential_fields.append(col_name)

    if not potential_fields:
        print("  (No obvious quote reference fields found)")
        return

    # Query verification invoices
    print(f"\nVerification queries for {table_name}:")
    print("-" * 80)

    verification_cases = [
        (1190, 2332),
        (1177, 2312),
        (1156, 2290),
    ]

    for invoice_no, expected_quote in verification_cases:
        print(f"\n  [VERIFY] Invoice {invoice_no} → Expected Quote {expected_quote}")

        # Build query with potential fields
        field_list = ", ".join([f"t.[{f}]" for f in potential_fields])

        if join_field and join_table:
            # Table needs to be joined to FT
            query = f"""
            SELECT {field_list}
            FROM {table_name} t
            INNER JOIN {join_table} j ON t.{join_field} = j.{join_field}
            WHERE j.{invoice_field} = {invoice_no}
            """
        else:
            # Direct query on the table
            query = f"""
            SELECT {field_list}
            FROM {table_name} t
            WHERE t.{invoice_field} = {invoice_no}
            """

        try:
            cursor.execute(query)
            rows = cursor.fetchall()

            if not rows:
                print(f"    ⚠ No records found")
                continue

            # Check each row
            for row_idx, row in enumerate(rows):
                if row_idx > 0:
                    print(f"\n    Row {row_idx + 1}:")
                match_found = False
                for i, field_name in enumerate(potential_fields):
                    value = row[i]
                    if value and str(expected_quote) in str(value):
                        print(f"      ✓✓✓ {field_name} = {value} ← MATCH!")
                        match_found = True
                    elif value:
                        print(f"      {field_name} = {value}")

                if not match_found:
                    print(f"    ✗ No field contains quote {expected_quote}")

        except Exception as e:
            print(f"    [ERROR] Query failed: {e}")


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

        print_section_header("PHC QUOTE-INVOICE LINK FINDER")
        print(
            "\nSearching for fields that link invoices to quotes across multiple tables:"
        )
        print("  - FT  (Faturas - Invoices)")
        print("  - BO  (Orçamentos - Quotes)")
        print("  - BI  (Documentos Internos)")
        print("  - FI  (Fichas Inventário)")
        print("  - FI2 (Fichas Inventário - Dados Adicionais)")
        print("  - FT2 (Faturas - Outros Dados)")
        print("  - FT3 (Faturas - Informação Complementar)")
        print("  - FTCC (Faturas - ???)")

        # Check FT table directly
        check_table_for_quote_links(cursor, "ft", "fno")

        # Check BO table (Quotes)
        check_table_for_quote_links(cursor, "bo", "obrano")

        # Check BI table
        check_table_for_quote_links(cursor, "bi", "bino")

        # Check FI table
        check_table_for_quote_links(cursor, "fi", "fino")

        # Check FI2 table (joined to FI, then check if it links to FT)
        print_section_header("TABLE: FI2 (Joined to FI)")
        fi2_cols = get_all_columns(cursor, "fi2")
        if fi2_cols:
            print(f"\n[INFO] Found {len(fi2_cols)} columns in FI2 table")
            print("\nAll FI2 columns:")
            for col_name, data_type, max_length in fi2_cols:
                length_info = f"({max_length})" if max_length else ""
                print(f"  {col_name:30} {data_type}{length_info}")

        # Check FT2 table (joined to FT)
        print_section_header("TABLE: FT2 (Joined to FT)")
        ft2_cols = get_all_columns(cursor, "ft2")
        if ft2_cols:
            print(f"\n[INFO] Found {len(ft2_cols)} columns in FT2 table")

            # Look for potential quote fields
            potential_fields = []
            print("\nPotential quote reference fields:")
            print("-" * 80)
            for col_name, data_type, max_length in ft2_cols:
                length_info = f"({max_length})" if max_length else ""
                is_potential = any(
                    keyword in col_name.lower()
                    for keyword in [
                        "ref",
                        "doc",
                        "obs",
                        "bo",
                        "orca",
                        "numero",
                        "livre",
                        "texto",
                        "campo",
                    ]
                )
                if is_potential:
                    print(f"  ✓ {col_name:30} {data_type}{length_info}")
                    potential_fields.append(col_name)

            if potential_fields:
                print("\nVerification queries for FT2:")
                print("-" * 80)

                verification_cases = [(1190, 2332), (1177, 2312), (1156, 2290)]

                for invoice_no, expected_quote in verification_cases:
                    print(
                        f"\n  [VERIFY] Invoice {invoice_no} → Expected Quote {expected_quote}"
                    )

                    field_list = ", ".join([f"ft2.[{f}]" for f in potential_fields])
                    query = f"""
                    SELECT {field_list}
                    FROM ft2
                    INNER JOIN ft ON ft2.ftstamp = ft.ftstamp
                    WHERE ft.fno = {invoice_no}
                    """

                    try:
                        cursor.execute(query)
                        rows = cursor.fetchall()

                        if not rows:
                            print(f"    ⚠ No FT2 record found for invoice {invoice_no}")
                            continue

                        for row in rows:
                            match_found = False
                            for i, field_name in enumerate(potential_fields):
                                value = row[i]
                                if value and str(expected_quote) in str(value):
                                    print(f"      ✓✓✓ {field_name} = {value} ← MATCH!")
                                    match_found = True
                                elif value:
                                    print(f"      {field_name} = {value}")

                            if not match_found:
                                print(
                                    f"    ✗ No FT2 field contains quote {expected_quote}"
                                )

                    except Exception as e:
                        print(f"    [ERROR] Query failed: {e}")

        # Check FT3 table (joined to FT)
        print_section_header("TABLE: FT3 (Joined to FT)")
        ft3_cols = get_all_columns(cursor, "ft3")
        if ft3_cols:
            print(f"\n[INFO] Found {len(ft3_cols)} columns in FT3 table")

            # Look for potential quote fields
            potential_fields = []
            print("\nPotential quote reference fields:")
            print("-" * 80)
            for col_name, data_type, max_length in ft3_cols:
                length_info = f"({max_length})" if max_length else ""
                is_potential = any(
                    keyword in col_name.lower()
                    for keyword in [
                        "ref",
                        "doc",
                        "obs",
                        "bo",
                        "orca",
                        "numero",
                        "livre",
                        "texto",
                    ]
                )
                if is_potential:
                    print(f"  ✓ {col_name:30} {data_type}{length_info}")
                    potential_fields.append(col_name)

            if potential_fields:
                print("\nVerification queries for FT3:")
                print("-" * 80)

                verification_cases = [(1190, 2332), (1177, 2312), (1156, 2290)]

                for invoice_no, expected_quote in verification_cases:
                    print(
                        f"\n  [VERIFY] Invoice {invoice_no} → Expected Quote {expected_quote}"
                    )

                    field_list = ", ".join([f"ft3.[{f}]" for f in potential_fields])
                    query = f"""
                    SELECT {field_list}
                    FROM ft3
                    INNER JOIN ft ON ft3.ftstamp = ft.ftstamp
                    WHERE ft.fno = {invoice_no}
                    """

                    try:
                        cursor.execute(query)
                        rows = cursor.fetchall()

                        if not rows:
                            print(f"    ⚠ No FT3 record found for invoice {invoice_no}")
                            continue

                        for row in rows:
                            match_found = False
                            for i, field_name in enumerate(potential_fields):
                                value = row[i]
                                if value and str(expected_quote) in str(value):
                                    print(f"      ✓✓✓ {field_name} = {value} ← MATCH!")
                                    match_found = True
                                elif value:
                                    print(f"      {field_name} = {value}")

                            if not match_found:
                                print(
                                    f"    ✗ No FT3 field contains quote {expected_quote}"
                                )

                    except Exception as e:
                        print(f"    [ERROR] Query failed: {e}")

        # Check FTCC table
        check_table_for_quote_links(cursor, "ftcc", "fno")

        print_section_header("SUMMARY")
        print("\n[TIP] Check the sections above for ✓✓✓ MATCH! markers to identify")
        print("      which table and field contain the quote numbers that link")
        print("      invoices to quotes.")

        cursor.close()
        conn.close()

        print("\n[OK] Query completed successfully")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
