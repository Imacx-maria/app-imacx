"""
Sync New Fields - Run this to populate the new fields added to BO and FT tables

This script will:
1. Sync current year data (bo, ft) with new fields
2. Sync historical data (2years_bo, 2years_ft) with new fields

New fields added:
- BO: created_by (ousrinis)
- FT: salesperson_name (vendnm), customer_name (nome), created_by (ousrinis)
"""

import os
import subprocess
import sys
from pathlib import Path

# Set UTF-8 encoding for Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_script(script_path, description):
    """Run a Python script and capture output"""
    print(f"\n{'=' * 80}")
    print(f"{description}")
    print("=" * 80)

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes max
            encoding="utf-8",
            errors="replace",
        )

        print(result.stdout)

        if result.returncode != 0:
            print(f"\n[ERROR] Script failed with exit code {result.returncode}")
            print(result.stderr)
            return False

        # Check for __ETL_DONE__ marker
        if "__ETL_DONE__ success=true" in result.stdout:
            print(f"\n✅ {description} - SUCCESS")
            return True
        elif "__ETL_DONE__ success=false" in result.stdout:
            print(f"\n❌ {description} - FAILED")
            return False
        else:
            print(f"\n✅ {description} - COMPLETED")
            return True

    except subprocess.TimeoutExpired:
        print(f"\n[ERROR] Script timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"\n[ERROR] Failed to run script: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    print("=" * 80)
    print("SYNC NEW FIELDS - BO & FT TABLES")
    print("=" * 80)
    print("\nThis will add and populate the following new fields:")
    print("  BO Table:")
    print("    - created_by (ousrinis)")
    print("\n  FT Table:")
    print("    - salesperson_name (vendnm)")
    print("    - customer_name (nome)")
    print("    - created_by (ousrinis)")
    print("\n" + "=" * 80)

    results = {}

    # Step 1: Sync current year data (fast, incremental)
    print("\n[STEP 1] Syncing current year data (bo, ft)...")
    script1 = PROJECT_ROOT / "scripts" / "etl" / "run_fast_all_tables_sync.py"
    if script1.exists():
        results["current_year"] = run_script(
            script1, "STEP 1: Current Year Sync (Last 3 Days)"
        )
    else:
        print(f"[WARN] Script not found: {script1}")
        print("[INFO] Trying alternative sync method...")
        # Try the today sync as fallback
        script1_alt = PROJECT_ROOT / "scripts" / "etl" / "run_today_bo_bi.py"
        if script1_alt.exists():
            results["current_year"] = run_script(
                script1_alt, "STEP 1: Today's Sync (BO/BI)"
            )
        else:
            print(f"[ERROR] No sync script found!")
            results["current_year"] = False

    # Step 2: Sync historical data (2 years)
    print("\n[STEP 2] Syncing historical data (2years_bo, 2years_ft)...")
    script2 = PROJECT_ROOT / "scripts" / "etl" / "run_annual_historical.py"
    if script2.exists():
        results["historical"] = run_script(
            script2, "STEP 2: Historical Sync (Last 2 Years)"
        )
    else:
        print(f"[ERROR] Script not found: {script2}")
        results["historical"] = False

    # Summary
    print("\n" + "=" * 80)
    print("SYNC SUMMARY")
    print("=" * 80)

    for step, success in results.items():
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"  {step}: {status}")

    all_success = all(results.values())

    if all_success:
        print("\n✅ All syncs completed successfully!")
        print("\n📊 Next steps:")
        print("  1. Verify the new fields are populated:")
        print("     SELECT created_by, COUNT(*) FROM phc.bo GROUP BY created_by;")
        print(
            "     SELECT salesperson_name, customer_name, created_by FROM phc.ft LIMIT 10;"
        )
        print("\n  2. The new fields are now available in your app!")
        sys.exit(0)
    else:
        print("\n❌ Some syncs failed. Please check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
