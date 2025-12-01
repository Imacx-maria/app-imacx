"""
Temporary BI Import Script - UNFILTERED for Quote Pricing Analysis

PURPOSE:
- Import ALL BI lines (including those without qtt/values) for quotes by user MAM
- Date range: 2024-12-01 to 2025-12-01
- This is a TEMPORARY consultation table - won't affect production phc.bi

DIFFERENCE FROM PRODUCTION:
- Production phc.bi filter: "qtt IS NOT NULL AND qtt != 0" (excludes description lines)
- This script: NO qtt filter (includes ALL lines to see paragraph format)

OUTPUT:
- Creates phc.temp_quotes_bi table
- Creates phc.temp_quotes_bo table (filtered quotes for reference)
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
import pyodbc
from dotenv import load_dotenv

# Setup paths
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

# Configuration
DATE_START = "2025-01-01"
DATE_END = "2025-12-31"
USER_FILTER = "MAM"

# BO columns to import (same as production)
BO_COLUMNS = {
    "bostamp": "TEXT NOT NULL",
    "obrano": "TEXT NOT NULL",
    "nmdos": "TEXT",
    "no": "INTEGER",
    "dataobra": "DATE",
    "obranome": "TEXT",
    "obs": "TEXT",
    "origem": "TEXT",
    "ebo_2tvall": "NUMERIC",
    "marca": "TEXT",
    "ousrinis": "TEXT",
}

BO_COLUMN_MAPPINGS = {
    "bostamp": "document_id",
    "obrano": "document_number",
    "nmdos": "document_type",
    "no": "customer_id",
    "dataobra": "document_date",
    "obranome": "observacoes",
    "obs": "nome_trabalho",
    "origem": "origin",
    "ebo_2tvall": "total_value",
    "marca": "last_delivery_date",
    "ousrinis": "created_by",
}

# BI columns - same as production PLUS additional useful columns
BI_COLUMNS = {
    "bistamp": "TEXT NOT NULL",
    "bostamp": "TEXT NOT NULL",
    "obrano": "NUMERIC",  # Line number within the quote (PHC uses obrano in bi)
    "design": "TEXT",  # Line description (this is what we want!)
    "qtt": "NUMERIC",  # Quantity (NULL for description lines)
    "ettdeb": "NUMERIC",  # Total line value (Euro)
    "edebito": "NUMERIC",  # Euro unit price (NOT pu which is old Escudo value!)
    "ref": "TEXT",  # Item reference
    "ccusto": "TEXT",  # Cost center
    "lordem": "NUMERIC",  # Line order (for sorting)
}

BI_COLUMN_MAPPINGS = {
    "bistamp": "line_id",
    "bostamp": "document_id",
    "obrano": "line_number",
    "design": "description",
    "qtt": "quantity",
    "ettdeb": "line_total",
    "edebito": "unit_price",  # edebito = Euro: Venda (correct unit price)
    "ref": "item_reference",
    "ccusto": "cost_center",
    "lordem": "line_order",
}


class TempQuotesImporter:
    def __init__(self):
        self.phc_conn = None
        self.supabase_conn = None
        self.stats = {
            "bo_rows": 0,
            "bi_rows_unfiltered": 0,
            "bi_rows_filtered_comparison": 0,
        }

    def connect_phc(self) -> bool:
        """Connect to PHC (MSSQL) database"""
        try:
            conn_str = os.getenv("MSSQL_DIRECT_CONNECTION")
            if not conn_str:
                raise ValueError("Missing MSSQL_DIRECT_CONNECTION environment variable")
            self.phc_conn = pyodbc.connect(conn_str, timeout=30)
            logger.info("[OK] Connected to PHC database")
            return True
        except Exception as e:
            logger.error(f"[ERROR] PHC connection failed: {e}")
            return False

    def connect_supabase(self) -> bool:
        """Connect to Supabase (PostgreSQL)"""
        try:
            self.supabase_conn = psycopg2.connect(
                host=os.getenv("PG_HOST"),
                dbname=os.getenv("PG_DB"),
                user=os.getenv("PG_USER"),
                password=os.getenv("PG_PASSWORD"),
                port=os.getenv("PG_PORT", "5432"),
                sslmode=os.getenv("PG_SSLMODE", "require"),
            )
            cursor = self.supabase_conn.cursor()
            cursor.execute("CREATE SCHEMA IF NOT EXISTS phc")
            self.supabase_conn.commit()
            logger.info("[OK] Connected to Supabase")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Supabase connection failed: {e}")
            return False

    def close_connections(self):
        """Close all database connections"""
        if self.phc_conn:
            self.phc_conn.close()
        if self.supabase_conn:
            self.supabase_conn.close()

    def create_temp_tables(self):
        """Create temporary tables in Supabase (DROP if exists)"""
        cursor = self.supabase_conn.cursor()

        # Drop existing temp tables
        cursor.execute("DROP TABLE IF EXISTS phc.temp_quotes_bi CASCADE")
        cursor.execute("DROP TABLE IF EXISTS phc.temp_quotes_bo CASCADE")
        self.supabase_conn.commit()
        logger.info("[OK] Dropped existing temp tables")

        # Create temp_quotes_bo
        bo_cols = []
        for col, col_type in BO_COLUMNS.items():
            mapped_name = BO_COLUMN_MAPPINGS.get(col, col)
            bo_cols.append(f'"{mapped_name}" {col_type}')

        create_bo_sql = f"""
            CREATE TABLE phc.temp_quotes_bo (
                {", ".join(bo_cols)},
                PRIMARY KEY ("document_id")
            )
        """
        cursor.execute(create_bo_sql)
        logger.info("[OK] Created phc.temp_quotes_bo")

        # Create temp_quotes_bi
        bi_cols = []
        for col, col_type in BI_COLUMNS.items():
            mapped_name = BI_COLUMN_MAPPINGS.get(col, col)
            bi_cols.append(f'"{mapped_name}" {col_type}')

        create_bi_sql = f"""
            CREATE TABLE phc.temp_quotes_bi (
                {", ".join(bi_cols)},
                PRIMARY KEY ("line_id")
            )
        """
        cursor.execute(create_bi_sql)
        logger.info("[OK] Created phc.temp_quotes_bi")

        self.supabase_conn.commit()

    def import_quotes_bo(self) -> list[str]:
        """Import filtered BO quotes and return list of bostamps"""
        logger.info(
            f"[IMPORT] Importing BO quotes: {DATE_START} to {DATE_END}, user={USER_FILTER}"
        )

        column_names = list(BO_COLUMNS.keys())
        select_cols = ", ".join([f"[{col}]" for col in column_names])

        query = f"""
            SELECT {select_cols}
            FROM [bo]
            WHERE [dataobra] >= '{DATE_START}'
              AND [dataobra] <= '{DATE_END}'
              AND [ousrinis] = '{USER_FILTER}'
              AND [nmdos] = 'Orçamento'
            ORDER BY [dataobra] DESC
        """

        phc_cursor = self.phc_conn.cursor()
        phc_cursor.execute(query)

        # Prepare insert statement
        mapped_cols = [BO_COLUMN_MAPPINGS.get(col, col) for col in column_names]
        placeholders = ", ".join(["%s"] * len(mapped_cols))
        col_list = ", ".join([f'"{col}"' for col in mapped_cols])
        insert_sql = (
            f"INSERT INTO phc.temp_quotes_bo ({col_list}) VALUES ({placeholders})"
        )

        bostamps = []
        rows_imported = 0
        supabase_cursor = self.supabase_conn.cursor()

        while True:
            rows = phc_cursor.fetchmany(1000)
            if not rows:
                break

            batch = []
            for row in rows:
                processed_row = []
                for i, val in enumerate(row):
                    col_name = column_names[i]
                    if col_name == "bostamp" and val:
                        bostamps.append(val)

                    # Process value based on type
                    if val is None:
                        processed_row.append(None)
                    elif "INTEGER" in BO_COLUMNS[col_name].upper():
                        try:
                            processed_row.append(int(float(val)))
                        except (ValueError, TypeError):
                            processed_row.append(None)
                    elif "NUMERIC" in BO_COLUMNS[col_name].upper():
                        try:
                            processed_row.append(float(val))
                        except (ValueError, TypeError):
                            processed_row.append(None)
                    elif "DATE" in BO_COLUMNS[col_name].upper():
                        if isinstance(val, datetime):
                            processed_row.append(val.date())
                        else:
                            processed_row.append(val)
                    else:
                        processed_row.append(str(val).strip() if val else None)

                batch.append(tuple(processed_row))

            if batch:
                psycopg2.extras.execute_batch(
                    supabase_cursor, insert_sql, batch, page_size=500
                )
                rows_imported += len(batch)

        self.supabase_conn.commit()
        self.stats["bo_rows"] = rows_imported
        logger.info(f"[OK] Imported {rows_imported} quotes (BO)")

        return bostamps

    def import_bi_unfiltered(self, bostamps: list[str]):
        """Import ALL BI lines for the given quotes - NO qtt filter"""
        logger.info(
            f"[IMPORT] Importing BI lines (UNFILTERED) for {len(bostamps)} quotes"
        )

        if not bostamps:
            logger.warning("[WARN] No bostamps to import")
            return

        column_names = list(BI_COLUMNS.keys())
        select_cols = ", ".join([f"[{col}]" for col in column_names])

        # Build IN clause with proper quoting
        bostamp_list = ", ".join([f"'{bs}'" for bs in bostamps])

        # CRITICAL: NO qtt filter here - we want ALL lines
        query = f"""
            SELECT {select_cols}
            FROM [bi]
            WHERE [bostamp] IN ({bostamp_list})
            ORDER BY [bostamp], [lordem], [obrano]
        """

        phc_cursor = self.phc_conn.cursor()
        phc_cursor.execute(query)

        # Prepare insert statement
        mapped_cols = [BI_COLUMN_MAPPINGS.get(col, col) for col in column_names]
        placeholders = ", ".join(["%s"] * len(mapped_cols))
        col_list = ", ".join([f'"{col}"' for col in mapped_cols])
        insert_sql = (
            f"INSERT INTO phc.temp_quotes_bi ({col_list}) VALUES ({placeholders})"
        )

        rows_imported = 0
        supabase_cursor = self.supabase_conn.cursor()

        while True:
            rows = phc_cursor.fetchmany(5000)
            if not rows:
                break

            batch = []
            for row in rows:
                processed_row = []
                for i, val in enumerate(row):
                    col_name = column_names[i]

                    if val is None:
                        processed_row.append(None)
                    elif "INTEGER" in BI_COLUMNS[col_name].upper():
                        try:
                            processed_row.append(int(float(val)))
                        except (ValueError, TypeError):
                            processed_row.append(None)
                    elif "NUMERIC" in BI_COLUMNS[col_name].upper():
                        try:
                            processed_row.append(float(val))
                        except (ValueError, TypeError):
                            processed_row.append(None)
                    else:
                        processed_row.append(str(val).strip() if val else None)

                batch.append(tuple(processed_row))

            if batch:
                psycopg2.extras.execute_batch(
                    supabase_cursor, insert_sql, batch, page_size=1000
                )
                rows_imported += len(batch)

        self.supabase_conn.commit()
        self.stats["bi_rows_unfiltered"] = rows_imported
        logger.info(f"[OK] Imported {rows_imported} BI lines (UNFILTERED)")

    def count_filtered_comparison(self, bostamps: list[str]):
        """Count how many rows would be imported WITH the production filter"""
        if not bostamps:
            return

        bostamp_list = ", ".join([f"'{bs}'" for bs in bostamps])

        # This is the PRODUCTION filter
        query = f"""
            SELECT COUNT(*)
            FROM [bi]
            WHERE [bostamp] IN ({bostamp_list})
              AND [qtt] IS NOT NULL
              AND [qtt] != 0
        """

        phc_cursor = self.phc_conn.cursor()
        phc_cursor.execute(query)
        result = phc_cursor.fetchone()
        self.stats["bi_rows_filtered_comparison"] = result[0] if result else 0

    def get_sample_quotes(self) -> list[dict]:
        """Get 5 sample quotes with ALL their BI lines"""
        cursor = self.supabase_conn.cursor()

        # Get 5 quotes with most lines
        cursor.execute("""
            SELECT bo.document_id, bo.document_number, bo.document_date,
                   bo.nome_trabalho, bo.total_value,
                   COUNT(bi.line_id) as line_count
            FROM phc.temp_quotes_bo bo
            JOIN phc.temp_quotes_bi bi ON bo.document_id = bi.document_id
            GROUP BY bo.document_id, bo.document_number, bo.document_date,
                     bo.nome_trabalho, bo.total_value
            ORDER BY line_count DESC
            LIMIT 5
        """)

        quotes = []
        for row in cursor.fetchall():
            quote = {
                "document_id": row[0],
                "document_number": row[1],
                "document_date": row[2],
                "nome_trabalho": row[3],
                "total_value": row[4],
                "line_count": row[5],
                "lines": [],
            }

            # Get all lines for this quote
            cursor.execute(
                """
                SELECT line_number, line_order, description, quantity,
                       unit_price, line_total, item_reference, cost_center
                FROM phc.temp_quotes_bi
                WHERE document_id = %s
                ORDER BY line_order, line_number
            """,
                (quote["document_id"],),
            )

            for line in cursor.fetchall():
                quote["lines"].append(
                    {
                        "line_number": line[0],
                        "line_order": line[1],
                        "description": line[2],
                        "quantity": line[3],
                        "unit_price": line[4],
                        "line_total": line[5],
                        "item_reference": line[6],
                        "cost_center": line[7],
                    }
                )

            quotes.append(quote)

        return quotes

    def generate_report(self, sample_quotes: list[dict]) -> str:
        """Generate markdown report"""
        report = []
        report.append("# Temp Quotes BI Import Report")
        report.append(f"\nGenerated: {datetime.now().isoformat()}")
        report.append(f"\n## Configuration")
        report.append(f"- Date Range: {DATE_START} to {DATE_END}")
        report.append(f"- User Filter: {USER_FILTER}")
        report.append(f"- Document Type: Orcamento (quotes only)")

        report.append(f"\n## Row Count Comparison")
        report.append(f"\n| Metric | Count |")
        report.append(f"|--------|-------|")
        report.append(f"| Quotes (BO) | {self.stats['bo_rows']:,} |")
        report.append(
            f"| BI Lines (UNFILTERED - all lines) | {self.stats['bi_rows_unfiltered']:,} |"
        )
        report.append(
            f"| BI Lines (FILTERED - with qtt only) | {self.stats['bi_rows_filtered_comparison']:,} |"
        )

        diff = (
            self.stats["bi_rows_unfiltered"] - self.stats["bi_rows_filtered_comparison"]
        )
        pct = (
            (diff / self.stats["bi_rows_unfiltered"] * 100)
            if self.stats["bi_rows_unfiltered"] > 0
            else 0
        )
        report.append(f"| **Missing in Production** | **{diff:,}** ({pct:.1f}%) |")

        report.append(f"\n## What This Means")
        report.append(
            f"\nThe production `phc.bi` table is missing **{diff:,} rows** ({pct:.1f}% of all lines)."
        )
        report.append(
            f"These are description/paragraph lines that don't have quantities but contain important pricing context."
        )

        report.append(f"\n## Sample Quotes (5 with most lines)")

        for i, quote in enumerate(sample_quotes, 1):
            report.append(
                f"\n### {i}. Quote #{quote['document_number']} ({quote['document_date']})"
            )
            report.append(f"- **Work Name:** {quote['nome_trabalho'] or 'N/A'}")
            report.append(
                f"- **Total Value:** {quote['total_value']:,.2f} EUR"
                if quote["total_value"]
                else "- **Total Value:** N/A"
            )
            report.append(f"- **Total Lines:** {quote['line_count']}")

            report.append(
                f"\n| # | Order | Description | Qty | Unit Price | Total | Ref |"
            )
            report.append(
                f"|---|-------|-------------|-----|------------|-------|-----|"
            )

            for line in quote["lines"][:20]:  # Limit to 20 lines per quote
                desc = (line["description"] or "")[:50]
                if len(line["description"] or "") > 50:
                    desc += "..."
                qty = f"{line['quantity']:.2f}" if line["quantity"] else "-"
                pu = f"{line['unit_price']:.2f}" if line["unit_price"] else "-"
                total = f"{line['line_total']:.2f}" if line["line_total"] else "-"
                ref = line["item_reference"] or "-"

                report.append(
                    f"| {line['line_number'] or '-'} | {line['line_order'] or '-'} | {desc} | {qty} | {pu} | {total} | {ref} |"
                )

            if len(quote["lines"]) > 20:
                report.append(f"\n*... and {len(quote['lines']) - 20} more lines*")

        report.append(f"\n## Tables Created")
        report.append(f"\n- `phc.temp_quotes_bo` - Filtered quotes for reference")
        report.append(f"- `phc.temp_quotes_bi` - ALL BI lines (unfiltered)")

        report.append(f"\n## Usage")
        report.append(f"\n```sql")
        report.append(f"-- See all lines for a specific quote")
        report.append(f"SELECT * FROM phc.temp_quotes_bi")
        report.append(f"WHERE document_id = (")
        report.append(f"  SELECT document_id FROM phc.temp_quotes_bo")
        report.append(f"  WHERE document_number = 'YOUR_QUOTE_NUMBER'")
        report.append(f")")
        report.append(f"ORDER BY line_order, line_number;")
        report.append(f"```")

        return "\n".join(report)

    def run(self):
        """Main execution"""
        logger.info("=" * 60)
        logger.info("TEMP QUOTES BI IMPORT - UNFILTERED")
        logger.info("=" * 60)

        if not self.connect_phc() or not self.connect_supabase():
            print("__ETL_DONE__ success=false")
            return False

        try:
            # Create temp tables
            self.create_temp_tables()

            # Import BO quotes
            bostamps = self.import_quotes_bo()

            # Import ALL BI lines (unfiltered)
            self.import_bi_unfiltered(bostamps)

            # Get filtered count for comparison
            self.count_filtered_comparison(bostamps)

            # Get sample quotes
            sample_quotes = self.get_sample_quotes()

            # Generate report
            report = self.generate_report(sample_quotes)

            # Save report
            report_path = Path(__file__).parent / "temp_quotes_import_report.md"
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(report)
            logger.info(f"[OK] Report saved to: {report_path}")

            # Print summary
            print("\n" + "=" * 60)
            print("SUMMARY")
            print("=" * 60)
            print(f"Quotes imported: {self.stats['bo_rows']}")
            print(f"BI lines (UNFILTERED): {self.stats['bi_rows_unfiltered']}")
            print(
                f"BI lines (FILTERED - production): {self.stats['bi_rows_filtered_comparison']}"
            )
            print(
                f"Missing in production: {self.stats['bi_rows_unfiltered'] - self.stats['bi_rows_filtered_comparison']}"
            )
            print("=" * 60)

            print("__ETL_DONE__ success=true")
            return True

        except Exception as e:
            logger.error(f"[ERROR] Import failed: {e}")
            import traceback

            traceback.print_exc()
            print("__ETL_DONE__ success=false")
            return False

        finally:
            self.close_connections()


if __name__ == "__main__":
    importer = TempQuotesImporter()
    success = importer.run()
    sys.exit(0 if success else 1)
