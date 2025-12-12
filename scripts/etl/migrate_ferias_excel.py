"""
Migrate vacation/absence data from FERIAS_2025_B.xlsx to employee_situations table.

This script handles the CALENDAR FORMAT Excel file where:
- Row 0: Header with month names spanning multiple columns
- Row 1: Day numbers (1, 2, 3, ..., 31) for each month
- Row 2: Day names (Mon, Tue, Wed, ...)
- Row 3+: Employee data with DEPARTAMENTO, NOME, and situation codes (H, H1, H2, B, etc.)

The script:
1. Parses the calendar structure to map column indices to dates
2. Reads employee names and matches to rh_employees table
3. Identifies consecutive blocks of the same situation type
4. Calculates business days using database RPC
5. Inserts into employee_situations table

Usage:
    python migrate_ferias_excel.py             # Dry run (no changes)
    python migrate_ferias_excel.py --execute   # Actually insert data
    python migrate_ferias_excel.py --replace   # Replace existing 2025 data
"""

import argparse
import json
import logging
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas openpyxl")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Setup paths
THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]

# Load environment
ENV_CANDIDATES = [
    PROJECT_ROOT / ".env.local",
    PROJECT_ROOT / ".env",
    PROJECT_ROOT / "config" / ".env.local",
    PROJECT_ROOT / "config" / ".env",
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break
else:
    load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Excel file path
EXCEL_FILE = PROJECT_ROOT / "TEMP" / "FERIAS_2025_B.xlsx"

# Output files
LOG_FILE = PROJECT_ROOT / "TEMP" / "migration_ferias_2025_log.txt"
SUMMARY_FILE = PROJECT_ROOT / "TEMP" / "migration_ferias_2025_summary.json"

# Month name mapping (Portuguese to month number)
MONTH_MAPPING = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

# Valid situation type codes
VALID_CODES = {"H", "H1", "H2", "F", "E", "S", "M", "L", "W", "B", "C", "N"}

# Year for the data
DATA_YEAR = 2025


class FeriasMigration:
    def __init__(self, dry_run: bool = True, replace_existing: bool = False):
        self.dry_run = dry_run
        self.replace_existing = replace_existing
        self.conn = None
        self.employees = {}  # name (uppercase) -> employee record
        self.employees_by_sigla = {}  # sigla -> employee record
        self.situation_types = {}  # code -> situation_type record
        self.column_to_date = {}  # column index -> date
        self.summary = {
            "total_records": 0,
            "total_situations": 0,
            "inserted": 0,
            "skipped_duplicate": 0,
            "skipped_invalid": 0,
            "unmatched_employees": [],
            "unmatched_types": [],
            "errors": [],
        }

    def connect(self) -> bool:
        """Connect to Supabase PostgreSQL"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv("PG_HOST"),
                dbname=os.getenv("PG_DB"),
                user=os.getenv("PG_USER"),
                password=os.getenv("PG_PASSWORD"),
                port=os.getenv("PG_PORT", "5432"),
                sslmode=os.getenv("PG_SSLMODE", "require"),
            )
            logger.info("[OK] Connected to Supabase")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Database connection failed: {e}")
            return False

    def load_employees(self) -> bool:
        """Load all employees from rh_employees table"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute("""
                SELECT id, sigla, name, email, departamento_id, is_active
                FROM public.rh_employees
            """)
            rows = cursor.fetchall()

            for row in rows:
                # Index by normalized name
                name_key = row["name"].strip().upper()
                self.employees[name_key] = dict(row)
                # Also index by sigla
                if row["sigla"]:
                    self.employees_by_sigla[row["sigla"].upper()] = dict(row)

            logger.info(f"[OK] Loaded {len(self.employees)} employees")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Failed to load employees: {e}")
            return False

    def load_situation_types(self) -> bool:
        """Load all situation types from situation_types table"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute("""
                SELECT id, code, name, deducts_vacation, deduction_value, is_active
                FROM public.situation_types
                WHERE is_active = true
            """)
            rows = cursor.fetchall()

            for row in rows:
                self.situation_types[row["code"]] = dict(row)

            logger.info(f"[OK] Loaded {len(self.situation_types)} situation types")
            logger.info(f"     Available codes: {list(self.situation_types.keys())}")
            return True
        except Exception as e:
            logger.error(f"[ERROR] Failed to load situation types: {e}")
            return False

    def match_employee(self, name: str) -> Optional[dict]:
        """Match an employee by name"""
        if not name:
            return None

        name = str(name).strip()
        name_key = name.upper()

        # Try exact name match
        if name_key in self.employees:
            return self.employees[name_key]

        # Try sigla match
        if name_key in self.employees_by_sigla:
            return self.employees_by_sigla[name_key]

        # Try partial name match (first and last name)
        for emp_name, emp in self.employees.items():
            # Check if the input is contained in the employee name or vice versa
            if name_key in emp_name or emp_name in name_key:
                return emp
            # Check first name + last name match
            input_parts = name_key.split()
            emp_parts = emp_name.split()
            if len(input_parts) >= 2 and len(emp_parts) >= 2:
                if input_parts[0] == emp_parts[0] and input_parts[-1] == emp_parts[-1]:
                    return emp

        return None

    def calculate_business_days(self, start_date: date, end_date: date) -> float:
        """Calculate business days using database RPC function"""
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "SELECT public.calculate_working_days(%s, %s)", (start_date, end_date)
            )
            result = cursor.fetchone()
            return float(result[0]) if result and result[0] else 1.0
        except Exception as e:
            logger.warning(f"Failed to calculate business days via RPC: {e}")
            # Fallback: simple weekday count
            days = 0
            current = start_date
            while current <= end_date:
                if current.weekday() < 5:  # Monday = 0, Friday = 4
                    days += 1
                current += timedelta(days=1)
            return float(days) if days > 0 else 1.0

    def check_duplicate(
        self, employee_id: str, start_date: date, end_date: date, situation_type_id: str
    ) -> bool:
        """Check if a record already exists"""
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                """
                SELECT COUNT(*) FROM public.employee_situations
                WHERE employee_id = %s
                  AND start_date = %s
                  AND end_date = %s
                  AND situation_type_id = %s
            """,
                (employee_id, start_date, end_date, situation_type_id),
            )
            result = cursor.fetchone()
            return result[0] > 0 if result else False
        except Exception as e:
            logger.error(f"Error checking duplicate: {e}")
            return False

    def delete_2025_data(self):
        """Delete existing 2025 data (for replace mode)"""
        if self.dry_run:
            logger.info("[DRY RUN] Would delete 2025 data from employee_situations")
            return

        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                DELETE FROM public.employee_situations
                WHERE EXTRACT(YEAR FROM start_date) = 2025
            """)
            deleted = cursor.rowcount
            self.conn.commit()
            logger.info(f"[OK] Deleted {deleted} existing 2025 records")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Failed to delete 2025 data: {e}")

    def insert_situation(
        self,
        employee_id: str,
        situation_type_id: str,
        start_date: date,
        end_date: date,
        business_days: float,
        notes: Optional[str] = None,
    ) -> bool:
        """Insert a situation record"""
        if self.dry_run:
            logger.info(
                f"[DRY RUN] Would insert: employee={employee_id[:8]}... "
                f"dates={start_date} to {end_date} "
                f"days={business_days}"
            )
            return True

        try:
            cursor = self.conn.cursor()
            cursor.execute(
                """
                INSERT INTO public.employee_situations
                (employee_id, situation_type_id, start_date, end_date, business_days, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
            """,
                (
                    employee_id,
                    situation_type_id,
                    start_date,
                    end_date,
                    business_days,
                    notes,
                ),
            )
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            logger.error(f"[ERROR] Insert failed: {e}")
            return False

    def build_column_to_date_mapping(self, df: pd.DataFrame) -> Dict[int, date]:
        """Build a mapping from column index to date based on the calendar structure

        Excel structure (read with header=None):
        - Row 0: Month names (Janeiro at col 2, Fevereiro at col 33, etc.)
        - Row 1: Day numbers (1, 2, 3, ..., 31 for each month)
        - Row 2: Day names (Wed, Thu, Fri, etc.)
        - Row 3+: Employee data
        """
        mapping = {}

        # Get the header row (row 0 has month names)
        # Get row 1 which has day numbers
        header_row = df.iloc[0]  # Month names
        day_row = df.iloc[1] if len(df) > 1 else None  # Day numbers

        if day_row is None:
            logger.error("Could not find day numbers row")
            return mapping

        current_month = None

        for col_idx in range(
            2, len(df.columns)
        ):  # Skip DEPARTAMENTO (col 0) and NOME (col 1)
            # Check if this column has a month name in header (row 0)
            header_val = header_row.iloc[col_idx] if col_idx < len(header_row) else None
            if pd.notna(header_val):
                header_str = str(header_val).strip().lower()
                if header_str in MONTH_MAPPING:
                    current_month = MONTH_MAPPING[header_str]

            if current_month is None:
                continue

            # Get day number from row 1 (ALWAYS from row 1, never from column name)
            day_val = day_row.iloc[col_idx] if col_idx < len(day_row) else None
            if pd.isna(day_val):
                continue

            try:
                day_num = int(float(str(day_val)))
            except (ValueError, TypeError):
                continue

            if 1 <= day_num <= 31:
                try:
                    d = date(DATA_YEAR, current_month, day_num)
                    mapping[col_idx] = d
                except ValueError:
                    # Invalid date (e.g., Feb 30)
                    pass

        return mapping

    def find_consecutive_blocks(
        self, employee_data: pd.Series, column_mapping: Dict[int, date]
    ) -> List[Tuple[str, date, date]]:
        """Find consecutive blocks of the same situation type code"""
        blocks = []
        current_code = None
        block_start = None
        block_end = None

        # Sort columns by date
        sorted_cols = sorted(column_mapping.items(), key=lambda x: x[1])

        for col_idx, col_date in sorted_cols:
            if col_idx >= len(employee_data):
                continue

            cell_value = employee_data.iloc[col_idx]

            # Normalize the cell value
            code = None
            if pd.notna(cell_value):
                code_str = str(cell_value).strip().upper()
                if code_str in VALID_CODES:
                    code = code_str

            if code:
                if code == current_code and block_start:
                    # Continue the current block
                    block_end = col_date
                else:
                    # Save the previous block if exists
                    if current_code and block_start and block_end:
                        blocks.append((current_code, block_start, block_end))
                    elif current_code and block_start:
                        blocks.append((current_code, block_start, block_start))

                    # Start a new block
                    current_code = code
                    block_start = col_date
                    block_end = col_date
            else:
                # No code - save current block if exists
                if current_code and block_start and block_end:
                    blocks.append((current_code, block_start, block_end))
                elif current_code and block_start:
                    blocks.append((current_code, block_start, block_start))

                current_code = None
                block_start = None
                block_end = None

        # Don't forget the last block
        if current_code and block_start and block_end:
            blocks.append((current_code, block_start, block_end))
        elif current_code and block_start:
            blocks.append((current_code, block_start, block_start))

        return blocks

    def process_excel(self):
        """Process the Excel file and migrate data"""
        if not EXCEL_FILE.exists():
            logger.error(f"Excel file not found: {EXCEL_FILE}")
            return False

        logger.info(f"Reading Excel file: {EXCEL_FILE}")

        # Read without header to get the raw structure
        df = pd.read_excel(EXCEL_FILE, sheet_name="Sheet2", header=None)

        if df.empty:
            logger.error("Excel sheet is empty")
            return False

        logger.info(f"Found {len(df)} rows, {len(df.columns)} columns")

        # Build column to date mapping
        # The structure is:
        # Row 0: Header with month names (Janeiro, Fevereiro, etc.)
        # Row 1: Day numbers (1, 2, 3, etc.)
        # Row 2: Day names (Mon, Tue, etc.) - we skip this
        # Row 3+: Employee data

        self.column_to_date = self.build_column_to_date_mapping(df)
        logger.info(
            f"Built column-to-date mapping for {len(self.column_to_date)} date columns"
        )

        if not self.column_to_date:
            logger.error("Could not build column-to-date mapping")
            return False

        # Sample of mapping
        sample_mappings = list(self.column_to_date.items())[:5]
        logger.info(
            f"Sample mappings: {[(idx, d.isoformat()) for idx, d in sample_mappings]}"
        )

        # Find the data start row (skip header rows)
        # Row 0 = month names, Row 1 = day numbers, Row 2 = day names
        # Data starts at row 3 (index 3 in 0-based)
        data_start_row = 3

        # Process each employee row
        for row_idx in range(data_start_row, len(df)):
            row = df.iloc[row_idx]

            # Get employee name (column 1)
            employee_name = row.iloc[1] if len(row) > 1 else None
            department = row.iloc[0] if len(row) > 0 else None

            if pd.isna(employee_name) or not str(employee_name).strip():
                continue

            employee_name = str(employee_name).strip()
            self.summary["total_records"] += 1

            # Match employee
            employee = self.match_employee(employee_name)
            if not employee:
                if employee_name not in self.summary["unmatched_employees"]:
                    self.summary["unmatched_employees"].append(employee_name)
                    logger.warning(f"Could not match employee: {employee_name}")
                self.summary["skipped_invalid"] += 1
                continue

            # Find consecutive blocks of situation codes
            blocks = self.find_consecutive_blocks(row, self.column_to_date)

            for code, start_date, end_date in blocks:
                self.summary["total_situations"] += 1

                # Get situation type from database
                situation_type = self.situation_types.get(code)
                if not situation_type:
                    if code not in self.summary["unmatched_types"]:
                        self.summary["unmatched_types"].append(code)
                    logger.warning(f"Unknown situation code: {code}")
                    continue

                # Check for duplicates
                if not self.replace_existing:
                    if self.check_duplicate(
                        employee["id"], start_date, end_date, situation_type["id"]
                    ):
                        self.summary["skipped_duplicate"] += 1
                        continue

                # Calculate business days
                business_days = self.calculate_business_days(start_date, end_date)

                # Adjust for half-day situation types (H1, H2)
                if situation_type["deduction_value"] == 0.5:
                    business_days = business_days * 0.5

                # Insert record
                notes = (
                    f"Imported from Excel - Dept: {department}"
                    if pd.notna(department)
                    else "Imported from Excel"
                )

                if self.insert_situation(
                    employee["id"],
                    situation_type["id"],
                    start_date,
                    end_date,
                    business_days,
                    notes,
                ):
                    self.summary["inserted"] += 1
                    logger.info(
                        f"  {employee['name']}: {code} {start_date} to {end_date} ({business_days} days)"
                    )
                else:
                    self.summary["errors"].append(
                        {
                            "employee": employee_name,
                            "code": code,
                            "dates": f"{start_date} - {end_date}",
                            "error": "Insert failed",
                        }
                    )

        return True

    def run(self):
        """Run the migration"""
        logger.info("=" * 60)
        logger.info("FERIAS Excel Migration (Calendar Format)")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'EXECUTE'}")
        logger.info(f"Replace existing: {self.replace_existing}")
        logger.info("=" * 60)

        if not self.connect():
            return False

        if not self.load_employees():
            return False

        if not self.load_situation_types():
            return False

        if self.replace_existing:
            self.delete_2025_data()

        if not self.process_excel():
            return False

        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total employee rows processed: {self.summary['total_records']}")
        logger.info(f"Total situation blocks found: {self.summary['total_situations']}")
        logger.info(f"Inserted: {self.summary['inserted']}")
        logger.info(f"Skipped (duplicate): {self.summary['skipped_duplicate']}")
        logger.info(f"Skipped (invalid): {self.summary['skipped_invalid']}")

        if self.summary["unmatched_employees"]:
            logger.warning(
                f"\nUnmatched employees ({len(self.summary['unmatched_employees'])}):"
            )
            for emp in self.summary["unmatched_employees"]:
                logger.warning(f"  - {emp}")

        if self.summary["unmatched_types"]:
            logger.warning(
                f"\nUnmatched situation types ({len(self.summary['unmatched_types'])}):"
            )
            for typ in self.summary["unmatched_types"]:
                logger.warning(f"  - {typ}")

        if self.summary["errors"]:
            logger.error(f"\nErrors ({len(self.summary['errors'])}):")
            for err in self.summary["errors"][:5]:
                logger.error(f"  - {err}")

        # Save summary to file
        with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
            json.dump(self.summary, f, indent=2, ensure_ascii=False, default=str)
        logger.info(f"\nSummary saved to: {SUMMARY_FILE}")

        return True

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate vacation data from Excel to database"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually insert data (default is dry-run)",
    )
    parser.add_argument(
        "--replace", action="store_true", help="Replace existing 2025 data"
    )
    args = parser.parse_args()

    migration = FeriasMigration(dry_run=not args.execute, replace_existing=args.replace)

    try:
        success = migration.run()
        if success:
            logger.info("\n[OK] Migration completed successfully")
        else:
            logger.error("\n[ERROR] Migration failed")
            sys.exit(1)
    finally:
        migration.close()


if __name__ == "__main__":
    main()
