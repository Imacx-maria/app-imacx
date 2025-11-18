"""
Selective PHC to Supabase Sync
Import only specific columns and apply filters
"""

import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg2
import psycopg2.extras
import pyodbc
from dotenv import load_dotenv

# Updated path: go up 2 levels from scripts/etl_core/ to project root
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


def _current_year_start_date() -> date:
    today = datetime.utcnow().date()
    return date(today.year, 1, 1)


def get_one_year_ago_filter():
    """Get filter for records from the last 1 year"""
    current_year_start = _current_year_start_date().isoformat()
    return f"dataobra >= '{current_year_start}'"


def get_one_year_ago_filter_bo():
    """Get filter for BO table - last 1 year and exclude zero-value supplier orders."""
    base = get_one_year_ago_filter()
    # Exclude supplier orders with zero total value while keeping other document types untouched.
    return (
        f"{base} AND (nmdos <> 'Encomenda a Fornecedor' "
        "OR COALESCE(ebo_2tvall, 0) <> 0)"
    )


def get_three_years_ago_filter():
    """Get filter for records from the last 3 years"""
    three_years_ago = (datetime.now() - timedelta(days=1095)).strftime("%Y-%m-%d")
    return f"dataobra >= '{three_years_ago}'"


def get_last_7_days_filter():
    """Get filter for records from the last 7 days"""
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    return f"dataobra >= '{seven_days_ago}'"


def get_one_year_ago_filter_bi():
    """Get filter for BI table - last 1 year from today (dynamic)"""
    current_year_start = _current_year_start_date().isoformat()
    return f"[bostamp] IN (SELECT [bostamp] FROM [bo] WHERE [dataobra] >= '{current_year_start}') AND qtt IS NOT NULL AND qtt != 0"


def get_three_years_ago_filter_bi():
    """Get filter for BI table - last 3 years from today (dynamic)"""
    three_years_ago = (datetime.now() - timedelta(days=1095)).strftime("%Y-%m-%d")
    # Align BI with BO documents from last 3 years; include lines with quantity present
    return f"[bostamp] IN (SELECT [bostamp] FROM [bo] WHERE [dataobra] >= '{three_years_ago}') AND qtt IS NOT NULL AND qtt != 0"


def get_one_year_ago_filter_ft():
    """Get filter for FT table - last 1 year from today (dynamic)"""
    current_year_start = _current_year_start_date().isoformat()
    return f"fdata >= '{current_year_start}'"


def get_three_years_ago_filter_ft():
    """Get filter for FT table - last 3 years from today (dynamic)"""
    three_years_ago = (datetime.now() - timedelta(days=1095)).strftime("%Y-%m-%d")
    return f"fdata >= '{three_years_ago}'"


def get_last_7_days_filter_bi():
    """Get filter for BI table - last 7 days from today (dynamic)"""
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    # Align BI with BO documents from last 7 days; include lines with quantity present
    return f"[bostamp] IN (SELECT [bostamp] FROM [bo] WHERE [dataobra] >= '{seven_days_ago}') AND qtt IS NOT NULL AND qtt != 0"


def get_last_3_days_filter():
    """Get filter for records from the last 3 days"""
    three_days_ago = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
    return f"dataobra >= '{three_days_ago}'"


def get_last_7_days_filter_ft():
    """Get filter for FT table - last 7 days from today (dynamic)"""
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    return f"fdata >= '{seven_days_ago}'"


def get_one_year_ago_filter_fi():
    """Get filter for FI table - last 1 year from today (dynamic)"""
    current_year_start = _current_year_start_date().isoformat()
    # Join with FT table to filter by invoice date and exclude cancelled documents
    # Only include lines with non-zero values (matching 2years_fi behavior)
    return f"[ftstamp] IN (SELECT [ftstamp] FROM [ft] WHERE [fdata] >= '{current_year_start}' AND COALESCE(CONVERT(VARCHAR(10), anulado), '') IN ('', '0', 'N')) AND [etiliquido] IS NOT NULL AND [etiliquido] <> 0"


def get_one_year_ago_filter_fo():
    current_year_start = _current_year_start_date().isoformat()
    return f"pdata >= '{current_year_start}'"


# Table configurations - define exactly what you want to sync
TABLE_CONFIGS = {
    "cl": {
        "columns": {
            "no": "INTEGER NOT NULL",  # PHC: no - Customer number
            "nome": "TEXT",  # PHC: nome - Customer name (allow NULL for incomplete records)
            "morada": "TEXT",  # PHC: morada - Address
            "local": "TEXT",  # PHC: local - City/Location
            "codpost": "TEXT",  # PHC: codpost - Postal code
            "inactivo": "BOOLEAN",  # PHC: inactivo - Inactive flag
            "vendnm": "TEXT",  # PHC: vendnm - Salesperson name (defaults to IMACX if NULL)
        },
        "column_mappings": {
            "no": "customer_id",  # Clearer: customer number → customer_id
            "nome": "customer_name",  # Clearer: nome → customer_name
            "morada": "address",  # Clearer: morada → address
            "local": "city",  # Clearer: local → city
            "codpost": "postal_code",  # Clearer: codpost → postal_code
            "inactivo": "is_inactive",  # Clearer: inactivo → is_inactive
            "vendnm": "salesperson",  # Clearer: vendnm → salesperson
        },
        "filter": None,  # Import ALL customers (active and inactive)
        "description": "All Customers",
        "primary_key": "customer_id",
        "source_date_column": None,
        "supports_incremental": False,
    },
    "bo": {
        "columns": {
            "bostamp": "TEXT NOT NULL",  # PHC: bostamp - Primary key/stamp
            "obrano": "TEXT NOT NULL",  # PHC: obrano - Document number
            "nmdos": "TEXT",  # PHC: nmdos - Document type (Folha de Obra / Orçamento)
            "no": "INTEGER",  # PHC: no - Customer number (FK to cl.no)
            "dataobra": "DATE",  # PHC: dataobra - Document date
            "obranome": "TEXT",  # PHC: obranome - Observations (mislabeled in PHC)
            "obs": "TEXT",  # PHC: obs - Work name/description (mislabeled in PHC)
            "origem": "TEXT",  # PHC: origem - Document origin (BO = from budget)
            "ebo_2tvall": "NUMERIC",  # PHC: ebo_2tvall - Total value
            "marca": "DATE",  # PHC: marca - Delivery date (stored as VARCHAR "DD.MM.YYYY", converted to DATE)
            "ousrinis": "TEXT",  # PHC: ousrinis - User initials/code who created the document
        },
        "column_mappings": {
            "bostamp": "document_id",  # Clearer: bostamp → document_id
            "obrano": "document_number",  # Clearer: obrano → document_number
            "nmdos": "document_type",  # Clearer: nmdos → document_type
            "no": "customer_id",  # Clearer: no → customer_id (FK)
            "dataobra": "document_date",  # Clearer: dataobra → document_date
            "obranome": "observacoes",  # Fixed: obranome → observacoes (PHC naming is wrong)
            "obs": "nome_trabalho",  # Fixed: obs → nome_trabalho (PHC naming is wrong)
            "origem": "origin",  # Clearer: origem → origin
            "ebo_2tvall": "total_value",  # Clearer: ebo_2tvall → total_value
            "marca": "last_delivery_date",  # PHC: marca → last_delivery_date (delivery date, stored as "DD.MM.YYYY" in VARCHAR)
            "ousrinis": "created_by",  # PHC: ousrinis → created_by (user who created the document)
        },
        "filter": get_one_year_ago_filter_bo,  # Last 1 year & no zero-value supplier orders
        "description": "Work Orders/Budgets (Last 1 Year)",
        "primary_key": "document_id",
        "source_date_column": "dataobra",
        "retention_column": "document_date",
        "supports_incremental": True,
    },
    "bi": {
        "columns": {
            "bistamp": "TEXT NOT NULL",  # PHC: bistamp - Primary key/line stamp
            "bostamp": "TEXT NOT NULL",  # PHC: bostamp - Foreign key to bo.bostamp
            "design": "TEXT",  # PHC: design - Line description
            "qtt": "NUMERIC",  # PHC: qtt - Quantity
            "ettdeb": "NUMERIC",  # PHC: ettdeb - Total line value in Euro
            "pu": "NUMERIC",  # PHC: pu - Unit price
            "ref": "TEXT",  # PHC: ref - Item reference
            "ccusto": "TEXT",  # PHC: ccusto - Cost center (BR-Brindes or ID-Impressão Digital)
        },
        "column_mappings": {
            "bistamp": "line_id",  # Clearer: bistamp → line_id
            "bostamp": "document_id",  # Clearer: bostamp → document_id (FK)
            "design": "description",  # Clearer: design → description
            "qtt": "quantity",  # Clearer: qtt → quantity
            "ettdeb": "line_total",  # Clearer: ettdeb → line_total
            "pu": "unit_price",  # Clearer: pu → unit_price
            "ref": "item_reference",  # Clearer: ref → item_reference
            "ccusto": "cost_center",  # Clearer: ccusto → cost_center
        },
        "filter": get_one_year_ago_filter_bi,  # Last 1 year from today (dynamic)
        "description": "Document Lines (Last 1 Year)",
        "primary_key": "line_id",
        "source_date_column": None,
        "parent_source_table": "bo",
        "parent_source_key_column": "bostamp",
        "parent_source_date_column": "dataobra",
        "supports_incremental": True,
    },
    "ft": {
        "columns": {
            "ftstamp": "TEXT NOT NULL",  # PHC: ftstamp - Primary key/stamp
            "fno": "INTEGER NOT NULL",  # PHC: fno - Invoice/document number
            "no": "INTEGER",  # PHC: no - Customer number (FK to cl.no)
            "fdata": "DATE",  # PHC: fdata - Invoice/document date
            "nmdoc": "TEXT",  # PHC: nmdoc - Document type (Factura, Nota de Crédito, etc.)
            "ettiliq": "NUMERIC",  # PHC: ettiliq - Net value WITHOUT VAT (can be negative)
            "anulado": "TEXT",  # PHC: ANULADO - Cancelled flag
            "vendnm": "TEXT",  # PHC: vendnm - Salesperson name
            "nome": "TEXT",  # PHC: nome - Customer name
            "ousrinis": "TEXT",  # PHC: ousrinis - User initials/code who created the invoice
        },
        "column_mappings": {
            "ftstamp": "invoice_id",  # Clearer: ftstamp → invoice_id
            "fno": "invoice_number",  # Clearer: fno → invoice_number
            "no": "customer_id",  # Clearer: no → customer_id (FK)
            "fdata": "invoice_date",  # Clearer: fdata → invoice_date
            "nmdoc": "document_type",  # Clearer: nmdoc → document_type
            "ettiliq": "net_value",  # Clearer: ettiliq → net_value (without VAT)
            "anulado": "anulado",  # PHC: ANULADO → anulado
            "vendnm": "salesperson_name",  # PHC: vendnm → salesperson_name
            "nome": "customer_name",  # PHC: nome → customer_name
            "ousrinis": "created_by",  # PHC: ousrinis → created_by (user who created the invoice)
        },
        "filter": get_one_year_ago_filter_ft,  # Last 1 year from today (dynamic)
        "description": "Invoices/Credit Notes (Last 1 Year)",
        "primary_key": "invoice_id",
        "source_date_column": "fdata",
        "retention_column": "invoice_date",
        "supports_incremental": True,
    },
    "fo": {
        "columns": {
            "fostamp": "TEXT NOT NULL",
            "aivamv9": "TEXT",
            "pdata": "DATE",
            "ettiliq": "NUMERIC",
            "nome": "TEXT",
            "adoc": "TEXT",
            "tipo": "TEXT",
            "etotal": "NUMERIC",
        },
        "column_mappings": {
            "fostamp": "document_id",
            "aivamv9": "internal_document_number",
            "pdata": "document_date",
            "ettiliq": "net_liquid_value",
            "nome": "customer_name",
            "adoc": "document_number",
            "tipo": "document_type",
            "etotal": "total_value",
        },
        "filter": get_one_year_ago_filter_fo,
        "description": "Folha de Obra Documents (Last 1 Year)",
        "primary_key": "document_id",
        "source_date_column": "pdata",
        "retention_column": "document_date",
        "supports_incremental": True,
    },
    "fi": {
        "columns": {
            "fistamp": "TEXT NOT NULL",  # PHC: fistamp - Primary key/line item stamp
            "ftstamp": "TEXT NOT NULL",  # PHC: ftstamp - Foreign key to ft.ftstamp
            "fno": "INTEGER",  # PHC: fno - Document number
            "ficcusto": "TEXT",  # PHC: ficcusto - Cost center (Centro Analítico)
            "fivendnm": "TEXT",  # PHC: fivendnm - Salesperson name
            "etiliquido": "NUMERIC",  # PHC: etiliquido - Net liquid value
            "bistamp": "TEXT",  # PHC: bistamp - Links to BI quote line items (for invoice-quote tracing)
        },
        "column_mappings": {
            "fistamp": "line_item_id",  # Clearer: fistamp → line_item_id
            "ftstamp": "invoice_id",  # Clearer: ftstamp → invoice_id (FK)
            "fno": "document_number",  # Clearer: fno → document_number
            "ficcusto": "cost_center",  # Clearer: ficcusto → cost_center
            "fivendnm": "salesperson_name",  # Clearer: fivendnm → salesperson_name
            "etiliquido": "net_liquid_value",  # Clearer: etiliquido → net_liquid_value
            "bistamp": "bistamp",  # Keep original name for clarity (links to bi.bistamp)
        },
        "filter": get_one_year_ago_filter_fi,  # Last 1 year from today (dynamic), excludes cancelled and zero-value lines
        "description": "Invoice Line Items (Last 1 Year, Non-Zero)",
        "primary_key": "line_item_id",
        "source_date_column": None,
        "parent_source_table": "ft",
        "parent_source_key_column": "ftstamp",
        "parent_source_date_column": "fdata",
        "supports_incremental": True,
    },
    "fl": {
        "columns": {
            "no": "INTEGER NOT NULL",  # PHC: no - Supplier number
            "nome": "TEXT",  # PHC: nome - Supplier name
            "ccusto": "TEXT",  # PHC: ccusto - Cost center
            "inactivo": "BOOLEAN",  # PHC: inactivo - Inactive flag
        },
        "column_mappings": {
            "no": "supplier_id",  # Clearer: no → supplier_id
            "nome": "supplier_name",  # Clearer: nome → supplier_name
            "ccusto": "cost_center",  # Clearer: ccusto → cost_center
            "inactivo": "is_inactive",  # Clearer: inactivo → is_inactive
        },
        "filter": "inactivo = 0",  # Import only active suppliers (INACTIVO = false)
        "description": "Active Suppliers",
        "primary_key": "supplier_id",
        "source_date_column": None,
        "supports_incremental": False,
    },
}


class SelectiveSync:
    def __init__(self):
        self.phc_conn = None
        self.supabase_conn = None

    def connect_phc(self):
        """Connect to PHC database"""
        try:
            conn_str = os.getenv("MSSQL_DIRECT_CONNECTION")
            if not conn_str or not isinstance(conn_str, str):
                raise ValueError(
                    "Missing MSSQL_DIRECT_CONNECTION. Set it in the environment or .env file."
                )
            self.phc_conn = pyodbc.connect(conn_str, timeout=30)
            logger.info("[OK] Connected to PHC database")
            return True
        except Exception as e:
            logger.error(f"[ERROR] PHC connection failed: {e}")
            return False

    def connect_supabase(self):
        """Connect to Supabase and create PHC schema"""
        try:
            self.supabase_conn = psycopg2.connect(
                host=os.getenv("PG_HOST"),
                dbname=os.getenv("PG_DB"),
                user=os.getenv("PG_USER"),
                password=os.getenv("PG_PASSWORD"),
                port=os.getenv("PG_PORT", "5432"),
                sslmode=os.getenv("PG_SSLMODE", "require"),
            )

            # Create PHC schema
            cursor = self.supabase_conn.cursor()
            cursor.execute("CREATE SCHEMA IF NOT EXISTS phc")
            self.supabase_conn.commit()

            logger.info("[OK] Connected to Supabase")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Supabase connection failed: {e}")
            return False

    # ------------------------------------------------------------------
    # Incremental helpers
    # ------------------------------------------------------------------
    def _ensure_watermark_table(self) -> None:
        assert self.supabase_conn is not None, "Supabase connection not established"
        cursor = self.supabase_conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS phc.sync_watermarks (
                table_name TEXT PRIMARY KEY,
                watermark DATE NOT NULL,
                last_sync_time TIMESTAMP DEFAULT NOW()
            )
            """
        )
        self.supabase_conn.commit()

    def _get_watermark(self, table_name: str, default_value: date) -> date:
        assert self.supabase_conn is not None, "Supabase connection not established"
        cursor = self.supabase_conn.cursor()
        cursor.execute(
            "SELECT watermark FROM phc.sync_watermarks WHERE table_name = %s",
            (table_name,),
        )
        row = cursor.fetchone()
        if row and row[0]:
            value = row[0]
            if isinstance(value, datetime):
                return value.date()
            return value
        return default_value

    def _update_watermark(self, table_name: str, value: date) -> None:
        assert self.supabase_conn is not None, "Supabase connection not established"
        cursor = self.supabase_conn.cursor()
        cursor.execute(
            """
            INSERT INTO phc.sync_watermarks (table_name, watermark, last_sync_time)
            VALUES (%s, %s, NOW())
            ON CONFLICT (table_name) DO UPDATE
            SET watermark = EXCLUDED.watermark,
                last_sync_time = NOW()
            """,
            (table_name, value),
        )
        self.supabase_conn.commit()

    def _should_skip_table(self, table_name: str, skip_hours: int = 24) -> bool:
        """Check if table was synced recently and should be skipped."""
        assert self.supabase_conn is not None, "Supabase connection not established"
        cursor = self.supabase_conn.cursor()
        cursor.execute(
            """
            SELECT last_sync_time
            FROM phc.sync_watermarks
            WHERE table_name = %s
            AND last_sync_time > NOW() - INTERVAL '%s hours'
            """,
            (table_name, skip_hours),
        )
        return cursor.fetchone() is not None

    def _retention_anchor(self, months: int) -> date:
        return _current_year_start_date()

    def _ensure_target_table(self, table_name: str, config: dict) -> None:
        assert self.supabase_conn is not None, "Supabase connection not established"
        columns = config["columns"]
        column_mappings = config.get("column_mappings", {})
        primary_key = config.get("primary_key")

        column_defs = []
        for col, col_type in columns.items():
            final_col = column_mappings.get(col, col)
            column_defs.append(f'"{final_col}" {col_type}')

        pk_clause = ""
        if primary_key:
            pk_clause = f', PRIMARY KEY ("{primary_key}")'

        create_sql = f'''
            CREATE TABLE IF NOT EXISTS phc."{table_name}" (
                {", ".join(column_defs)}{pk_clause}
            )
        '''

        cursor = self.supabase_conn.cursor()
        try:
            cursor.execute(create_sql)
            self.supabase_conn.commit()
            logger.info(f"   [OK] Table phc.{table_name} ready with PK constraint")
        except Exception as e:
            self.supabase_conn.rollback()
            logger.error(f"   [ERROR] Failed to create table phc.{table_name}: {e}")
            raise

    def _build_incremental_query(
        self,
        table_name: str,
        column_names: list[str],
        config: dict,
        start_date_str: str | None,
    ) -> tuple[str, int | None, int | None]:
        base_select = ", ".join([f"[{col}]" for col in column_names])

        source_date_column = config.get("source_date_column")
        supports_incremental = config.get("supports_incremental", False)

        if table_name == "bi" and supports_incremental and start_date_str:
            parent_table = config.get("parent_source_table", "bo")
            parent_key = config.get("parent_source_key_column", "bostamp")
            parent_date_column = config.get("parent_source_date_column", "dataobra")
            # Prefix columns with 'child.' alias to avoid ambiguous column errors
            child_select = ", ".join([f"child.[{col}]" for col in column_names])
            query = (
                f"SELECT {child_select}, parent.[{parent_date_column}] AS parent_date "
                f"FROM [{table_name}] AS child "
                f"JOIN [{parent_table}] AS parent ON parent.[{parent_key}] = child.[{parent_key}] "
                f"WHERE parent.[{parent_date_column}] >= '{start_date_str}' "
                f"AND child.[qtt] IS NOT NULL AND child.[qtt] <> 0"
            )
            return query, None, len(column_names)

        if table_name == "fi" and supports_incremental and start_date_str:
            parent_table = config.get("parent_source_table", "ft")
            parent_key = config.get("parent_source_key_column", "ftstamp")
            parent_date_column = config.get("parent_source_date_column", "fdata")
            # Prefix columns with 'child.' alias to avoid ambiguous column errors
            child_select = ", ".join([f"child.[{col}]" for col in column_names])
            query = (
                f"SELECT {child_select}, parent.[{parent_date_column}] AS parent_date "
                f"FROM [{table_name}] AS child "
                f"JOIN [{parent_table}] AS parent ON parent.[{parent_key}] = child.[{parent_key}] "
                f"WHERE parent.[{parent_date_column}] >= '{start_date_str}' "
                f"AND COALESCE(CONVERT(VARCHAR(10), parent.[anulado]), '') IN ('', '0', 'N') "
                f"AND child.[etiliquido] IS NOT NULL AND child.[etiliquido] <> 0"
            )
            return query, None, len(column_names)

        if supports_incremental and source_date_column and start_date_str:
            query = f"SELECT {base_select} FROM [{table_name}] WHERE [{source_date_column}] >= '{start_date_str}'"
            return query, column_names.index(source_date_column), None

        return f"SELECT {base_select} FROM [{table_name}]", None, None

    def _parse_marca_date(self, value) -> date | None:
        """Parse marca field which stores dates as 'DD.MM.YYYY' string format"""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        text_value = str(value).strip()
        # Return None for empty strings
        if not text_value or text_value == "":
            return None
        # Try DD.MM.YYYY format (PHC marca field format)
        try:
            return datetime.strptime(text_value, "%d.%m.%Y").date()
        except ValueError:
            pass
        # Fall back to standard formats
        for fmt in (
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%d/%m/%Y",
            "%d-%m-%Y",
        ):
            try:
                return datetime.strptime(text_value, fmt).date()
            except ValueError:
                continue
        return None

    def _coerce_to_date(self, value) -> date | None:
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        text_value = str(value)
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
            try:
                return datetime.strptime(text_value, fmt).date()
            except ValueError:
                continue
        return None

    def _prepare_clean_rows(
        self,
        table_name: str,
        columns: dict,
        column_names: list[str],
        rows,
        column_mappings: dict,
        date_index: int | None,
        extra_date_index: int | None,
    ) -> tuple[list[tuple], date | None]:
        clean_rows: list[tuple] = []
        batch_max_date: date | None = None

        for row in rows:
            clean_row = []
            for i, col_name in enumerate(column_names):
                col_type = columns[col_name].upper()
                val = row[i]

                if val is None:
                    if table_name == "cl" and col_name == "vendnm":
                        clean_row.append("IMACX")
                    elif table_name == "bi" and col_name == "ccusto":
                        clean_row.append("ID-Impressão Digital")
                    else:
                        clean_row.append(None)
                    continue

                if "INTEGER" in col_type:
                    try:
                        clean_row.append(int(float(val)))
                    except (ValueError, TypeError):
                        clean_row.append(None)
                elif "NUMERIC" in col_type:
                    try:
                        clean_row.append(float(val))
                    except (ValueError, TypeError):
                        clean_row.append(None)
                elif "BOOLEAN" in col_type:
                    clean_row.append(bool(val))
                elif "DATE" in col_type:
                    # Special handling for marca field (stored as VARCHAR "DD.MM.YYYY")
                    if table_name == "bo" and col_name == "marca":
                        parsed_date = self._parse_marca_date(val)
                        clean_row.append(parsed_date)
                    else:
                        # Regular date handling
                        parsed_date = self._coerce_to_date(val)
                        clean_row.append(parsed_date)
                else:
                    str_val = str(val).strip()
                    if table_name == "cl" and col_name == "vendnm" and not str_val:
                        clean_row.append("IMACX")
                    elif table_name == "bi" and col_name == "ccusto" and not str_val:
                        clean_row.append("ID-Impressão Digital")
                    else:
                        clean_row.append(str_val if str_val else None)

            row_date_value = None
            if date_index is not None:
                row_date_value = row[date_index]
            elif extra_date_index is not None:
                row_date_value = row[extra_date_index]

            row_date = self._coerce_to_date(row_date_value)
            if row_date and (batch_max_date is None or row_date > batch_max_date):
                batch_max_date = row_date

            clean_rows.append(tuple(clean_row))

        return clean_rows, batch_max_date

    def _purge_old_rows(
        self, table_name: str, config: dict, retention_start: date
    ) -> None:
        if not config.get("supports_incremental", False):
            return

        assert self.supabase_conn is not None, "Supabase connection not established"
        cursor = self.supabase_conn.cursor()

        retention_column = config.get("retention_column")
        if retention_column:
            cursor.execute(
                f'DELETE FROM phc."{table_name}" WHERE "{retention_column}" < %s',
                (retention_start,),
            )
        elif table_name == "bi":
            cursor.execute(
                """
                DELETE FROM phc."bi" AS child
                USING phc."bo" AS parent
                WHERE child.document_id = parent.document_id
                  AND parent.document_date < %s
                """,
                (retention_start,),
            )
        elif table_name == "fi":
            cursor.execute(
                """
                DELETE FROM phc."fi" AS child
                USING phc."ft" AS parent
                WHERE child.invoice_id = parent.invoice_id
                  AND parent.invoice_date < %s
                """,
                (retention_start,),
            )

        self.supabase_conn.commit()

    def _run_incremental_for_table(
        self,
        table_name: str,
        config: dict,
        overlap_days: int,
        retention_months: int,
    ) -> dict:
        logger.info(
            "[SYNC] Incremental sync for %s (%s)",
            table_name.upper(),
            config.get("description"),
        )

        try:
            self._ensure_target_table(table_name, config)

            columns = config["columns"]
            column_names = list(columns.keys())
            column_mappings = config.get("column_mappings", {})
            primary_key = config.get("primary_key")

            retention_start = self._retention_anchor(retention_months)

            watermark = retention_start
            start_date = None
            start_date_str = None

            if config.get("supports_incremental", False):
                watermark = self._get_watermark(table_name, retention_start)
                start_date = max(
                    retention_start, watermark - timedelta(days=overlap_days)
                )
                start_date_str = start_date.strftime("%Y-%m-%d")

            query, date_idx, extra_date_idx = self._build_incremental_query(
                table_name,
                column_names,
                config,
                start_date_str,
            )

            phc_cursor = self.phc_conn.cursor()
            phc_cursor.execute(query)

            final_column_names = [column_mappings.get(col, col) for col in column_names]
            placeholders = ",".join(["%s"] * len(final_column_names))
            column_list_pg = ",".join([f'"{col}"' for col in final_column_names])

            update_columns = [col for col in final_column_names if col != primary_key]
            if primary_key:
                if update_columns:
                    update_clause = ", ".join(
                        [f'"{col}" = EXCLUDED."{col}"' for col in update_columns]
                    )
                    insert_sql = (
                        f'INSERT INTO phc."{table_name}" ({column_list_pg}) '
                        f"VALUES ({placeholders}) "
                        f'ON CONFLICT ("{primary_key}") DO UPDATE SET {update_clause}'
                    )
                else:
                    # No special handling needed - all tables use PK for DO NOTHING
                    insert_sql = (
                        f'INSERT INTO phc."{table_name}" ({column_list_pg}) '
                        f"VALUES ({placeholders}) "
                        f'ON CONFLICT ("{primary_key}") DO NOTHING'
                    )
            else:
                insert_sql = f'INSERT INTO phc."{table_name}" ({column_list_pg}) VALUES ({placeholders})'

            batch_size = 1000
            total_rows = 0
            max_date_seen: date | None = None

            while True:
                rows = phc_cursor.fetchmany(batch_size)
                if not rows:
                    break

                clean_rows, batch_max_date = self._prepare_clean_rows(
                    table_name,
                    columns,
                    column_names,
                    rows,
                    column_mappings,
                    date_idx,
                    extra_date_idx,
                )

                if not clean_rows:
                    continue

                supabase_cursor = self.supabase_conn.cursor()
                supabase_cursor.executemany(insert_sql, clean_rows)
                self.supabase_conn.commit()

                total_rows += len(clean_rows)

                if batch_max_date:
                    if max_date_seen is None or batch_max_date > max_date_seen:
                        max_date_seen = batch_max_date

            self._purge_old_rows(table_name, config, retention_start)

            if config.get("supports_incremental", False):
                new_watermark = max_date_seen or watermark
                self._update_watermark(table_name, new_watermark)

            logger.info(
                "[OK] %s: %s rows processed (watermark=%s)",
                table_name.upper(),
                total_rows,
                max_date_seen.isoformat() if max_date_seen else watermark.isoformat(),
            )

            return {
                "success": True,
                "rows": total_rows,
                "description": config.get("description"),
                "watermark": (max_date_seen or watermark).isoformat(),
                "query_start": start_date_str,
            }

        except Exception as exc:
            logger.error(
                "[ERROR] Incremental sync failed for %s: %s", table_name.upper(), exc
            )
            if self.supabase_conn:
                self.supabase_conn.rollback()
            return {
                "success": False,
                "rows": 0,
                "description": config.get("description"),
                "error": str(exc),
            }

    def sync_fast_bo_bi_watermarked(
        self, overlap_days: int = 3, retention_months: int = 12
    ) -> dict:
        """Run a fast incremental sync for BO/BI/CL tables using watermarks (last 3 days)."""
        logger.info(
            "[FAST] Fast watermarked sync for BO/BI/CL (overlap=%s days)", overlap_days
        )

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            results = {}
            for table_name in ("cl", "bo", "bi"):
                config = TABLE_CONFIGS.get(table_name)
                if not config:
                    logger.warning(
                        "Config for table %s not found; skipping", table_name
                    )
                    continue

                # Skip CL if synced in last 24h - rarely changes
                if table_name == "cl" and self._should_skip_table("cl", skip_hours=24):
                    logger.info("[SKIP] CL: Skipped (synced within last 24h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                results[table_name] = self._run_incremental_for_table(
                    table_name,
                    config,
                    overlap_days,
                    retention_months,
                )
            return results
        finally:
            self.close_connections()

    def sync_fast_all_tables_3days(
        self, overlap_days: int = 3, retention_months: int = 12
    ) -> dict:
        """Run a fast incremental sync for ALL tables (CL, BO, BI, FT, FO, FI, FL) using watermarks."""
        logger.info(
            "[FAST] Fast watermarked sync for ALL tables (overlap=%s days)",
            overlap_days,
        )

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            results = {}
            for table_name in ("cl", "bo", "bi", "ft", "fo", "fi", "fl"):
                config = TABLE_CONFIGS.get(table_name)
                if not config:
                    logger.warning(
                        "Config for table %s not found; skipping", table_name
                    )
                    continue

                # Skip CL if synced in last 24h - rarely changes
                if table_name == "cl" and self._should_skip_table("cl", skip_hours=24):
                    logger.info("[SKIP] CL: Skipped (synced within last 24h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                # Skip FL if synced in last 24h - rarely changes (same as CL)
                if table_name == "fl" and self._should_skip_table("fl", skip_hours=24):
                    logger.info("[SKIP] FL: Skipped (synced within last 24h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                results[table_name] = self._run_incremental_for_table(
                    table_name,
                    config,
                    overlap_days,
                    retention_months,
                )
            return results
        finally:
            self.close_connections()

    def sync_fast_clients_3days(self):
        """Fast sync for clients only"""
        logger.info("[FAST] Fast client sync")
        if not self.connect_phc() or not self.connect_supabase():
            return False

        try:
            self._ensure_watermark_table()
            config = TABLE_CONFIGS.get("cl")
            if not config:
                return False

            result = self._run_incremental_for_table("cl", config, 3, 12)
            return result.get("success", False)
        finally:
            self.close_connections()

    def sync_today_bo_bi(self) -> dict:
        """Sync BO/BI/CL tables from today 00:00:00 (fastest for intraday updates)"""
        logger.info("[TODAY] Today-only sync for BO/BI/CL (from midnight)")

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            results = {}
            for table_name in ("cl", "bo", "bi"):
                config = TABLE_CONFIGS.get(table_name)
                if not config:
                    logger.warning(
                        "Config for table %s not found; skipping", table_name
                    )
                    continue

                # Skip CL if synced in last 6 hours - rarely changes during the day
                if table_name == "cl" and self._should_skip_table("cl", skip_hours=6):
                    logger.info("[SKIP] CL: Skipped (synced within last 6h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                results[table_name] = self._run_today_sync_for_table(table_name, config)
            return results
        finally:
            self.close_connections()

    def sync_today_clients(self) -> dict:
        """Sync clients only from today 00:00:00"""
        logger.info("[TODAY] Today-only sync for clients")

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            config = TABLE_CONFIGS.get("cl")
            if not config:
                return {}

            result = self._run_today_sync_for_table("cl", config)
            return {"cl": result}
        finally:
            self.close_connections()

    def sync_today_fl(self) -> dict:
        """Sync suppliers (FL table) only from today 00:00:00"""
        logger.info("[TODAY] Today-only sync for suppliers (FL)")

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            config = TABLE_CONFIGS.get("fl")
            if not config:
                return {}

            result = self._run_today_sync_for_table("fl", config)
            return {"fl": result}
        finally:
            self.close_connections()

    def sync_today_all_tables(self) -> dict:
        """Sync ALL tables (CL, BO, BI, FT, FO, FI, FL) from today 00:00:00"""
        logger.info("[TODAY] Today-only sync for ALL tables (from midnight)")

        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            results = {}
            for table_name in ("cl", "bo", "bi", "ft", "fo", "fi", "fl"):
                config = TABLE_CONFIGS.get(table_name)
                if not config:
                    logger.warning(
                        "Config for table %s not found; skipping", table_name
                    )
                    continue

                # Skip CL if synced in last 6 hours - rarely changes during the day
                if table_name == "cl" and self._should_skip_table("cl", skip_hours=6):
                    logger.info("[SKIP] CL: Skipped (synced within last 6h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                # Skip FL if synced in last 6 hours - rarely changes during the day
                if table_name == "fl" and self._should_skip_table("fl", skip_hours=6):
                    logger.info("[SKIP] FL: Skipped (synced within last 6h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                results[table_name] = self._run_today_sync_for_table(table_name, config)
            return results
        finally:
            self.close_connections()

    def _run_today_sync_for_table(self, table_name: str, config: dict) -> dict:
        """Sync a single table from today 00:00:00 (no overlap, fastest possible)"""
        logger.info(
            "[SYNC] Today sync for %s (%s)",
            table_name.upper(),
            config.get("description"),
        )

        try:
            self._ensure_target_table(table_name, config)

            columns = config["columns"]
            column_names = list(columns.keys())
            column_mappings = config.get("column_mappings", {})
            primary_key = config.get("primary_key")

            # Today at 00:00:00 (local system time)
            today_midnight = datetime.now().replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            start_date_str = today_midnight.strftime("%Y-%m-%d")

            query, date_idx, extra_date_idx = self._build_incremental_query(
                table_name,
                column_names,
                config,
                start_date_str,
            )

            phc_cursor = self.phc_conn.cursor()
            phc_cursor.execute(query)

            final_column_names = [column_mappings.get(col, col) for col in column_names]
            placeholders = ",".join(["%s"] * len(final_column_names))
            column_list_pg = ",".join([f'"{col}"' for col in final_column_names])

            update_columns = [col for col in final_column_names if col != primary_key]
            if primary_key:
                if update_columns:
                    update_clause = ", ".join(
                        [f'"{col}" = EXCLUDED."{col}"' for col in update_columns]
                    )
                    insert_sql = (
                        f'INSERT INTO phc."{table_name}" ({column_list_pg}) '
                        f"VALUES ({placeholders}) "
                        f'ON CONFLICT ("{primary_key}") DO UPDATE SET {update_clause}'
                    )
                else:
                    # No special handling needed - all tables use PK for DO NOTHING
                    insert_sql = (
                        f'INSERT INTO phc."{table_name}" ({column_list_pg}) '
                        f"VALUES ({placeholders}) "
                        f'ON CONFLICT ("{primary_key}") DO NOTHING'
                    )
            else:
                insert_sql = (
                    f'INSERT INTO phc."{table_name}" ({column_list_pg}) '
                    f"VALUES ({placeholders})"
                )

            supabase_cursor = self.supabase_conn.cursor()
            row_count = 0

            while True:
                rows = phc_cursor.fetchmany(5000)
                if not rows:
                    break

                batch = []
                for row in rows:
                    processed_row = []
                    for i, value in enumerate(row):
                        # Skip the extra_date_idx column - it's only used for filtering, not insertion
                        if extra_date_idx is not None and i == extra_date_idx:
                            continue
                        if i == date_idx:
                            if value:
                                if isinstance(value, datetime):
                                    processed_row.append(value.strftime("%Y-%m-%d"))
                                elif isinstance(value, date):
                                    processed_row.append(value.strftime("%Y-%m-%d"))
                                else:
                                    processed_row.append(value)
                            else:
                                processed_row.append(None)
                        else:
                            # Special handling for marca field (stored as VARCHAR "DD.MM.YYYY")
                            if (
                                table_name == "bo"
                                and i < len(column_names)
                                and column_names[i] == "marca"
                            ):
                                if value:
                                    parsed_date = self._parse_marca_date(value)
                                    processed_row.append(
                                        parsed_date.strftime("%Y-%m-%d")
                                        if parsed_date
                                        else None
                                    )
                                else:
                                    processed_row.append(None)
                            else:
                                processed_row.append(value)
                    batch.append(tuple(processed_row))

                if batch:
                    psycopg2.extras.execute_batch(
                        supabase_cursor, insert_sql, batch, page_size=1000
                    )
                    row_count += len(batch)

            self.supabase_conn.commit()

            # Update watermark
            self._update_watermark(table_name, datetime.now())

            logger.info(
                "[OK] %s: %d rows synced from %s",
                table_name.upper(),
                row_count,
                start_date_str,
            )
            return {
                "success": True,
                "rows": row_count,
                "description": config.get("description"),
                "start_date": start_date_str,
            }

        except Exception as e:
            logger.error("[ERROR] Error syncing %s: %s", table_name, e)
            if self.supabase_conn:
                self.supabase_conn.rollback()
            return {
                "success": False,
                "error": str(e),
                "description": config.get("description"),
            }

    def sync_incremental_year(self, overlap_days: int = 3, retention_months: int = 12):
        """Incremental sync for the current year"""
        if not self.connect_phc() or not self.connect_supabase():
            return {}

        try:
            self._ensure_watermark_table()
            tables = ["cl", "bo", "bi", "ft", "fo", "fi", "fl"]
            results = {}
            for table_name in tables:
                config = TABLE_CONFIGS.get(table_name)
                if not config:
                    continue

                # Skip CL (customers) if synced in last 24h - rarely changes
                if table_name == "cl" and self._should_skip_table("cl", skip_hours=24):
                    logger.info("[SKIP] CL: Skipped (synced within last 24h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                # Skip FL (suppliers) if synced in last 24h - rarely changes
                if table_name == "fl" and self._should_skip_table("fl", skip_hours=24):
                    logger.info("[SKIP] FL: Skipped (synced within last 24h)")
                    results[table_name] = {
                        "success": True,
                        "rows": 0,
                        "description": config.get("description"),
                        "skipped": True,
                    }
                    continue

                results[table_name] = self._run_incremental_for_table(
                    table_name,
                    config,
                    overlap_days,
                    retention_months,
                )
            return results
        finally:
            self.close_connections()

    def sync_table_selective(self, table_name, config):
        """Sync table with selective columns and filtering"""
        try:
            logger.info(f"[SYNC] Syncing {table_name} ({config['description']})")

            phc_cursor = self.phc_conn.cursor()
            supabase_cursor = self.supabase_conn.cursor()

            # Get column names and types
            columns = config["columns"]
            column_names = list(columns.keys())

            logger.info(f"   Columns: {', '.join(column_names)}")

            # Create table in Supabase with specific column types and mappings
            column_mappings = config.get("column_mappings", {})
            column_defs = []
            for col, col_type in columns.items():
                final_col_name = column_mappings.get(col, col)
                column_defs.append(f'"{final_col_name}" {col_type}')

            # Add primary key constraint if defined
            primary_key = config.get("primary_key")
            if primary_key:
                column_defs.append(f'PRIMARY KEY ("{primary_key}")')

            create_sql = f'''
                CREATE TABLE IF NOT EXISTS phc."{table_name}" (
                    {", ".join(column_defs)}
                )
            '''

            # Drop and recreate table (to handle column name changes)
            supabase_cursor.execute(f'DROP TABLE IF EXISTS phc."{table_name}" CASCADE')
            supabase_cursor.execute(create_sql)
            self.supabase_conn.commit()

            logger.info(f"   [OK] Table ready (recreated)")

            # Build selective query
            column_list = ", ".join([f"[{col}]" for col in column_names])

            query = f"SELECT {column_list} FROM [{table_name}]"
            if config.get("filter"):
                # Handle dynamic filters (functions) vs static filters (strings)
                filter_condition = config["filter"]
                if callable(filter_condition):
                    filter_condition = filter_condition()
                query += f" WHERE {filter_condition}"

            logger.info(f"   Query: {query}")

            # Execute query and get data
            phc_cursor.execute(query)

            batch_size = 1000
            total_rows = 0
            batch_num = 0

            print(f"   Fetching data from PHC...", flush=True)

            while True:
                rows = phc_cursor.fetchmany(batch_size)
                if not rows:
                    break

                batch_num += 1

                # Clean and prepare data
                clean_rows = []
                for row in rows:
                    clean_row = []
                    for i, val in enumerate(row):
                        col_name = column_names[i]
                        col_type = columns[col_name].upper()

                        if val is None:
                            # Special handling for vendnm in CL table - default to IMACX
                            if table_name == "cl" and col_name == "vendnm":
                                clean_row.append("IMACX")
                            # Special handling for ccusto in BI table - default to ID-Impressão Digital
                            elif table_name == "bi" and col_name == "ccusto":
                                clean_row.append("ID-Impressão Digital")
                            else:
                                clean_row.append(None)
                        else:
                            # Convert based on target column type
                            if "INTEGER" in col_type:
                                try:
                                    clean_row.append(
                                        int(float(val)) if val is not None else None
                                    )
                                except (ValueError, TypeError):
                                    clean_row.append(None)
                            elif "NUMERIC" in col_type:
                                try:
                                    # Correctly handle 0 values
                                    clean_row.append(
                                        float(val) if val is not None else None
                                    )
                                except (ValueError, TypeError):
                                    clean_row.append(None)
                            elif "BOOLEAN" in col_type:
                                clean_row.append(bool(val) if val is not None else None)
                            elif "DATE" in col_type:
                                # Special handling for marca field (stored as VARCHAR "DD.MM.YYYY")
                                if table_name == "bo" and col_name == "marca":
                                    parsed_date = self._parse_marca_date(val)
                                    clean_row.append(parsed_date)
                                else:
                                    # Regular date handling
                                    parsed_date = self._coerce_to_date(val)
                                    clean_row.append(parsed_date)
                            else:
                                str_val = str(val).strip() if val else None
                                # Special handling for vendnm in CL table - default to IMACX if empty
                                if (
                                    table_name == "cl"
                                    and col_name == "vendnm"
                                    and not str_val
                                ):
                                    clean_row.append("IMACX")
                                # Special handling for ccusto in BI table - default to ID-Impressão Digital if empty
                                elif (
                                    table_name == "bi"
                                    and col_name == "ccusto"
                                    and not str_val
                                ):
                                    clean_row.append("ID-Impressão Digital")
                                else:
                                    clean_row.append(str_val)

                    clean_rows.append(tuple(clean_row))

                # Validate for duplicate primary keys in batch
                if clean_rows:
                    primary_key = config.get("primary_key")
                    if primary_key:
                        # Find PK column index
                        pk_index = None
                        for i, col in enumerate(column_names):
                            final_col = column_mappings.get(col, col)
                            if final_col == primary_key:
                                pk_index = i
                                break

                        if pk_index is not None:
                            # Check for duplicates in batch
                            pk_values = [row[pk_index] for row in clean_rows]
                            unique_pk_values = set(pk_values)
                            if len(pk_values) != len(unique_pk_values):
                                duplicate_count = len(pk_values) - len(unique_pk_values)
                                logger.warning(
                                    f"   ⚠️  Batch {batch_num}: {duplicate_count} duplicate PK values detected in source data"
                                )

                # Insert batch with conflict handling
                if clean_rows:
                    placeholders = ",".join(["%s"] * len(column_names))
                    final_column_names = [
                        column_mappings.get(col, col) for col in column_names
                    ]
                    column_list_pg = ",".join(
                        [f'"{col}"' for col in final_column_names]
                    )

                    # Build INSERT with ON CONFLICT if primary key exists
                    primary_key = config.get("primary_key")
                    if primary_key:
                        # Build update clause for all columns except primary key
                        update_cols = [
                            f'"{col}" = EXCLUDED."{col}"'
                            for col in final_column_names
                            if col != primary_key
                        ]
                        if update_cols:
                            update_clause = ", ".join(update_cols)
                            insert_sql = (
                                f'INSERT INTO phc."{table_name}" ({column_list_pg}) VALUES ({placeholders}) '
                                f'ON CONFLICT ("{primary_key}") DO UPDATE SET {update_clause}'
                            )
                        else:
                            # No updatable columns - just ignore conflicts
                            insert_sql = (
                                f'INSERT INTO phc."{table_name}" ({column_list_pg}) VALUES ({placeholders}) '
                                f'ON CONFLICT ("{primary_key}") DO NOTHING'
                            )
                    else:
                        # No primary key - use plain INSERT (may cause duplicates)
                        logger.warning(
                            f"   ⚠️  No primary key defined for {table_name} - duplicates may occur"
                        )
                        insert_sql = f'INSERT INTO phc."{table_name}" ({column_list_pg}) VALUES ({placeholders})'

                    supabase_cursor.executemany(insert_sql, clean_rows)
                    self.supabase_conn.commit()

                    total_rows += len(clean_rows)

                    # Show progress every batch
                    print(
                        f"   [BATCH] Batch {batch_num}: {total_rows:,} rows synced...",
                        end="\r",
                        flush=True,
                    )

            # Clear progress line and show final result
            print(f"   [OK] Completed: {total_rows:,} rows synced" + " " * 20)
            logger.info(f"[OK] {table_name}: {total_rows:,} rows synced")
            return True, total_rows

        except Exception as e:
            logger.error(f"[ERROR] Error syncing {table_name}: {e}")
            return False, 0

    def sync_configured_tables(self):
        """Sync all configured tables"""
        if not self.connect_phc() or not self.connect_supabase():
            return False

        results = {}
        success_count = 0

        total_tables = len(TABLE_CONFIGS)
        logger.info(f"[SYNC] Syncing {total_tables} configured tables")
        print(f"\n{'=' * 80}")
        print(
            f"SYNCING {total_tables} TABLES: {', '.join(TABLE_CONFIGS.keys()).upper()}"
        )
        print(f"{'=' * 80}\n")

        for idx, (table_name, config) in enumerate(TABLE_CONFIGS.items(), 1):
            print(
                f"[{idx}/{total_tables}] {table_name.upper()} - {config['description']}"
            )
            success, row_count = self.sync_table_selective(table_name, config)
            results[table_name] = {
                "success": success,
                "rows": row_count,
                "description": config["description"],
            }
            if success:
                success_count += 1
            print()  # Add spacing between tables

        self.close_connections()

        logger.info(
            f"[DONE] Selective sync complete: {success_count}/{len(TABLE_CONFIGS)} tables"
        )

        # Show results
        print(f"\nSYNC RESULTS:")
        for table, result in results.items():
            status = "[OK]" if result["success"] else "[ERROR]"
            print(
                f"   {status} {table} ({result['description']}): {result['rows']:,} rows"
            )

        return results

    def close_connections(self):
        """Close database connections"""
        try:
            if self.phc_conn:
                self.phc_conn.close()
        except Exception:
            pass  # Connection might already be closed

        try:
            if self.supabase_conn:
                self.supabase_conn.close()
        except Exception:
            pass  # Connection might already be closed
