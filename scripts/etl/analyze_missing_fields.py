"""
Analyze PHC tables to identify potentially useful fields not currently synced
"""

import os
import sys
from pathlib import Path

import pyodbc
from dotenv import load_dotenv

# Set UTF-8 encoding for Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

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


def analyze_table(cursor, table_name, current_fields, focus_fields):
    """Analyze a table and show which useful fields are missing"""
    print(f"\n{'=' * 80}")
    print(f"TABLE: {table_name.upper()}")
    print("=" * 80)

    # Get all columns
    cursor.execute(f"""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '{table_name}'
        ORDER BY ORDINAL_POSITION
    """)
    all_columns = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

    # Check which focus fields exist and are not imported
    missing_fields = []
    for field in focus_fields:
        if field.lower() in [c.lower() for c in all_columns.keys()]:
            if field.lower() not in [c.lower() for c in current_fields]:
                missing_fields.append(field)

    if missing_fields:
        print(f"\n🔍 POTENTIALLY USEFUL FIELDS NOT CURRENTLY IMPORTED:")
        print("-" * 80)

        # Build query to show sample data
        select_fields = current_fields[:3]  # First 3 current fields for context
        select_fields.extend(missing_fields)

        # Make sure fields exist in actual table (case-insensitive match)
        actual_fields = []
        for field in select_fields:
            for actual_col in all_columns.keys():
                if field.lower() == actual_col.lower():
                    actual_fields.append(actual_col)
                    break

        query = f"SELECT TOP 10 {', '.join([f'[{f}]' for f in actual_fields])} FROM [{table_name}] ORDER BY 1 DESC"

        try:
            cursor.execute(query)
            rows = cursor.fetchall()

            # Print header
            print("  | " + " | ".join([f"{f[:18]:18}" for f in actual_fields]))
            print("  " + "-" * (len(actual_fields) * 21))

            # Print rows
            for row in rows:
                values = []
                for val in row:
                    if val is None:
                        values.append("NULL".ljust(18))
                    else:
                        str_val = str(val)[:18]
                        values.append(str_val.ljust(18))
                print("  | " + " | ".join(values))

            print("\n📋 FIELD ANALYSIS:")
            for field in missing_fields:
                # Count non-null values
                cursor.execute(
                    f"SELECT COUNT(*) FROM [{table_name}] WHERE [{field}] IS NOT NULL AND [{field}] <> ''"
                )
                count = cursor.fetchone()[0]
                cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
                total = cursor.fetchone()[0]
                usage = (count / total * 100) if total > 0 else 0

                data_type = all_columns.get(field, ("unknown", None))[0]
                print(
                    f"  ✓ {field:20} ({data_type:15}) - {usage:.1f}% populated ({count:,}/{total:,} records)"
                )

        except Exception as e:
            print(f"  ⚠️ Error querying sample data: {e}")
    else:
        print("\n✅ All recommended fields are already imported!")

    return missing_fields


def main():
    try:
        # Connect to PHC
        conn_str = os.getenv("MSSQL_DIRECT_CONNECTION")
        conn = pyodbc.connect(conn_str, timeout=30)
        cursor = conn.cursor()

        print("=" * 80)
        print("PHC SCHEMA GAP ANALYSIS")
        print("=" * 80)
        print("Analyzing tables to find useful fields not currently synced...\n")

        # ========================================
        # CL Table (Customers)
        # ========================================
        current_cl = ["no", "nome", "morada", "local", "codpost", "inactivo", "vendnm"]
        focus_cl = [
            "estab",  # Establishment number
            "ncont",  # Accounting number
            "tel",  # Phone
            "fax",  # Fax
            "email",  # Email
            "nif",  # Tax ID (NIF)
            "obs",  # Observations/notes
            "segmento",  # Market segment
            "zona",  # Zone/region
            "pais",  # Country
            "tlmvl",  # Mobile phone
            "site",  # Website
            "ccusto",  # Cost center
            "vendedor",  # Salesperson ID
            "credito",  # Credit limit
            "contp",  # Payment conditions
        ]
        missing_cl = analyze_table(cursor, "cl", current_cl, focus_cl)

        # ========================================
        # BO Table (Work Orders/Budgets)
        # ========================================
        current_bo = [
            "bostamp",
            "obrano",
            "nmdos",
            "no",
            "dataobra",
            "obranome",
            "obs",
            "origem",
            "ebo_2tvall",
            "marca",
            "ousrinis",
        ]
        focus_bo = [
            "vendedor",  # Salesperson ID
            "vendnm",  # Salesperson name
            "tecnico",  # Technician ID
            "tecnnm",  # Technician name
            "ccusto",  # Cost center
            "nome",  # Customer name (for reporting without joins)
            "fechada",  # Closed flag
            "datafecho",  # Close date
            "datafinal",  # Final date
            "estab",  # Establishment
            "periodo",  # Period
            "custo",  # Cost
            "etotal",  # Euro total
            "morada",  # Address
            "local",  # City
            "zona",  # Zone
            "segmento",  # Segment
            "tabela1",  # Price table
            "usrinis",  # Last modified by
            "usrdata",  # Last modified date
            "ousrdata",  # Created date
            "ousrhora",  # Created time
        ]
        missing_bo = analyze_table(cursor, "bo", current_bo, focus_bo)

        # ========================================
        # BI Table (Document Lines)
        # ========================================
        current_bi = [
            "bistamp",
            "bostamp",
            "design",
            "qtt",
            "ettdeb",
            "pu",
            "ref",
            "ccusto",
        ]
        focus_bi = [
            "armazem",  # Warehouse
            "lote",  # Batch/lot number
            "zona",  # Zone
            "familia",  # Product family
            "desconto",  # Discount
            "iva",  # VAT percentage
            "ivaincl",  # VAT included flag
            "tabela",  # Price table used
            "stns",  # Stock status
            "unidad",  # Unit of measure
        ]
        missing_bi = analyze_table(cursor, "bi", current_bi, focus_bi)

        # ========================================
        # FT Table (Invoices)
        # ========================================
        current_ft = [
            "ftstamp",
            "fno",
            "no",
            "fdata",
            "nmdoc",
            "ettiliq",
            "anulado",
            "vendnm",
            "nome",
            "ousrinis",
        ]
        focus_ft = [
            "vendedor",  # Salesperson ID
            "estab",  # Establishment
            "ccusto",  # Cost center
            "etotal",  # Euro total (with VAT)
            "morada",  # Address
            "local",  # City
            "codpost",  # Postal code
            "nmdesc",  # Description
            "obs",  # Observations
            "obrano",  # Work order number (if from BO)
            "bostamp",  # Work order stamp (link to BO)
            "segmento",  # Segment
            "zona",  # Zone
            "usrinis",  # Last modified by
            "usrdata",  # Last modified date
            "ousrdata",  # Created date
            "ousrhora",  # Created time
            "ndoc",  # Document number
            "ncont",  # Accounting number
            "databobra",  # Work order date
        ]
        missing_ft = analyze_table(cursor, "ft", current_ft, focus_ft)

        # ========================================
        # FI Table (Invoice Lines)
        # ========================================
        current_fi = ["fistamp", "ftstamp", "fno", "ficcusto", "fivendnm", "etiliquido"]
        focus_fi = [
            "ref",  # Product reference
            "design",  # Description
            "qtt",  # Quantity
            "pu",  # Unit price
            "desc1",  # Discount 1
            "ivaincl",  # VAT included
            "armazem",  # Warehouse
            "lote",  # Lot number
            "familia",  # Product family
            "unidad",  # Unit of measure
            "ezn",  # Zone
            "tabiva",  # VAT table
            "obrano",  # Work order number
            "bistamp",  # Link to BI (work order line)
        ]
        missing_fi = analyze_table(cursor, "fi", current_fi, focus_fi)

        # ========================================
        # FL Table (Suppliers)
        # ========================================
        current_fl = ["no", "nome", "ccusto", "inactivo"]
        focus_fl = [
            "morada",  # Address
            "local",  # City
            "codpost",  # Postal code
            "tel",  # Phone
            "fax",  # Fax
            "email",  # Email
            "nif",  # Tax ID
            "obs",  # Observations
            "pais",  # Country
            "zona",  # Zone
            "site",  # Website
            "contp",  # Payment conditions
            "ncont",  # Accounting number
        ]
        missing_fl = analyze_table(cursor, "fl", current_fl, focus_fl)

        # ========================================
        # Summary
        # ========================================
        print("\n" + "=" * 80)
        print("SUMMARY OF RECOMMENDATIONS")
        print("=" * 80)

        print("\n🎯 HIGH PRIORITY (Business Critical):")
        print("  BO Table:")
        print("    - vendnm, tecnnm: Track salespeople and technicians")
        print("    - fechada, datafecho: Track if work order is closed")
        print("    - nome: Customer name for easier reporting")
        print("    - etotal: Total value in Euro (with all calculations)")

        print("\n  FT Table:")
        print("    - etotal: Total with VAT (currently only have net_value)")
        print("    - bostamp, obrano: Link invoices to work orders")
        print("    - estab: Establishment for multi-location businesses")

        print("\n  FI Table:")
        print("    - ref, design, qtt, pu: Product details on invoice lines")
        print("    - obrano, bistamp: Link invoice lines to work orders")

        print("\n💡 MEDIUM PRIORITY (Analytics/Reporting):")
        print("  CL Table:")
        print("    - nif, email, tel: Contact information")
        print("    - segmento, zona: Market segmentation")
        print("    - credito, contp: Credit and payment terms")

        print("\n  BI Table:")
        print("    - armazem: Warehouse tracking")
        print("    - familia: Product family for categorization")
        print("    - desconto, iva: Pricing details")

        print("\n📊 LOW PRIORITY (Nice to Have):")
        print("  - usrdata, usrinis: Last modification tracking")
        print("  - ousrdata, ousrhora: Creation timestamp (you have ousrinis)")
        print("  - obs fields: Additional notes/observations")

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
