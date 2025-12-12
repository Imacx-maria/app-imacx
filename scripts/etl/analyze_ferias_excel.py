"""
Analyze FERIAS_2025_B.xlsx Excel file structure
This script reads the Excel file and outputs information about:
- Sheet names and structure
- Column headers and data types
- Sample data
- Employee identifiers
- Absence type codes used
- Date formats
"""

import json
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas openpyxl")
    sys.exit(1)

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed. Run: pip install openpyxl")
    sys.exit(1)

# Project root
THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]

# Excel file path
EXCEL_FILE = PROJECT_ROOT / "TEMP" / "FERIAS_2025_B.xlsx"


def analyze_excel():
    """Analyze the Excel file structure"""

    if not EXCEL_FILE.exists():
        print(f"ERROR: Excel file not found at: {EXCEL_FILE}")
        return None

    print(f"Analyzing: {EXCEL_FILE}")
    print("=" * 80)

    # Load workbook to get sheet names
    workbook = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    sheet_names = workbook.sheetnames
    print(f"\nSheet names: {sheet_names}")
    workbook.close()

    analysis = {"file": str(EXCEL_FILE), "sheets": {}}

    for sheet_name in sheet_names:
        print(f"\n{'=' * 80}")
        print(f"SHEET: {sheet_name}")
        print("=" * 80)

        # Read sheet with pandas
        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name, header=None)

        if df.empty:
            print("  (Empty sheet)")
            continue

        print(f"\nShape: {df.shape[0]} rows x {df.shape[1]} columns")

        # Try to identify header row
        # Look for rows that might be headers (contain text like "Nome", "Data", etc.)
        potential_headers = []
        for idx in range(min(10, len(df))):
            row = df.iloc[idx]
            row_values = [str(v).lower() if pd.notna(v) else "" for v in row]
            row_str = " ".join(row_values)

            # Check if this row looks like a header
            header_keywords = [
                "nome",
                "data",
                "tipo",
                "inicio",
                "fim",
                "dias",
                "ferias",
                "colaborador",
                "employee",
                "start",
                "end",
            ]
            if any(kw in row_str for kw in header_keywords):
                potential_headers.append((idx, row_values))

        header_row = None
        if potential_headers:
            header_row = potential_headers[0][0]
            print(f"\nPotential header row found at index {header_row}:")
            print(f"  {list(df.iloc[header_row])}")

        # Re-read with header if found
        if header_row is not None:
            df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name, header=header_row)
            print(f"\nColumns after applying header row {header_row}:")
            for col in df.columns:
                print(f"  - {col}: {df[col].dtype}")

        # Analyze columns
        print(f"\n--- Column Analysis ---")
        sheet_analysis = {
            "rows": len(df),
            "columns": len(df.columns),
            "header_row": header_row,
            "column_details": {},
        }

        for col in df.columns:
            col_data = df[col].dropna()
            if len(col_data) == 0:
                continue

            col_info = {
                "dtype": str(df[col].dtype),
                "non_null_count": len(col_data),
                "null_count": df[col].isna().sum(),
                "sample_values": [str(v) for v in col_data.head(5).tolist()],
                "unique_count": col_data.nunique(),
            }

            # Try to detect date columns
            if df[col].dtype == "datetime64[ns]":
                col_info["is_date"] = True
                col_info["date_range"] = {
                    "min": str(col_data.min()),
                    "max": str(col_data.max()),
                }
            elif df[col].dtype == "object":
                # Try parsing as date
                sample = col_data.iloc[0] if len(col_data) > 0 else None
                if sample:
                    try:
                        pd.to_datetime(sample)
                        col_info["might_be_date"] = True
                        col_info["date_format_sample"] = str(sample)
                    except:
                        pass

            # Check if this looks like a situation type code column
            col_str = str(col).lower()
            if "tipo" in col_str or "code" in col_str or "situacao" in col_str:
                col_info["unique_values"] = col_data.unique().tolist()[:20]

            sheet_analysis["column_details"][str(col)] = col_info

            print(f"\n  {col}:")
            print(f"    Type: {col_info['dtype']}")
            print(
                f"    Non-null: {col_info['non_null_count']}, Null: {col_info['null_count']}"
            )
            print(f"    Unique values: {col_info['unique_count']}")
            print(f"    Sample: {col_info['sample_values'][:3]}")

        # Look for employee identifiers
        print(f"\n--- Looking for employee identifiers ---")
        employee_cols = []
        for col in df.columns:
            col_str = str(col).lower()
            if any(
                kw in col_str
                for kw in [
                    "nome",
                    "name",
                    "colaborador",
                    "employee",
                    "sigla",
                    "iniciais",
                ]
            ):
                employee_cols.append(col)
                print(f"  Potential employee column: {col}")
                unique_vals = df[col].dropna().unique()[:10]
                print(f"    Sample values: {list(unique_vals)}")

        sheet_analysis["employee_columns"] = [str(c) for c in employee_cols]

        # Look for situation type codes
        print(f"\n--- Looking for situation type codes ---")
        # Situation codes from database: H, H1, H2, F, E, S, M, L, W, B, C, N
        known_codes = {"H", "H1", "H2", "F", "E", "S", "M", "L", "W", "B", "C", "N"}
        for col in df.columns:
            col_data = df[col].dropna().astype(str)
            unique_vals = set(col_data.str.strip().str.upper())
            matches = unique_vals.intersection(known_codes)
            if matches:
                print(f"  Column '{col}' contains situation codes: {matches}")
                sheet_analysis["situation_code_column"] = str(col)
                sheet_analysis["situation_codes_found"] = list(matches)

        # Look for date columns
        print(f"\n--- Date columns ---")
        date_cols = []
        for col in df.columns:
            col_str = str(col).lower()
            if any(
                kw in col_str
                for kw in ["data", "date", "inicio", "fim", "start", "end"]
            ):
                date_cols.append(col)
                print(f"  Potential date column: {col}")
                sample = df[col].dropna().head(3).tolist()
                print(f"    Sample values: {sample}")

        sheet_analysis["date_columns"] = [str(c) for c in date_cols]

        # Print sample rows
        print(f"\n--- Sample Data (first 5 rows) ---")
        print(df.head().to_string())

        analysis["sheets"][sheet_name] = sheet_analysis

    # Save analysis to JSON
    output_file = PROJECT_ROOT / "TEMP" / "ferias_excel_analysis.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n{'=' * 80}")
    print(f"Analysis saved to: {output_file}")
    print("=" * 80)

    return analysis


if __name__ == "__main__":
    analyze_excel()
