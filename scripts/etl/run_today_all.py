"""
Run today-only sync for ALL tables (CL, BO, BI, FT, FO)
Syncs data from today 00:00:00 onwards
"""

import sys
import os
from pathlib import Path

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add etl_core to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'etl_core'))

from selective_sync import SelectiveSync

def main():
    try:
        print(">> Starting today-only sync for ALL tables (from midnight)...")
        
        syncer = SelectiveSync()
        results = syncer.sync_today_all_tables()
        
        print(f"\n[DEBUG] Results received: {results}")
        
        if not results:
            print("[ERROR] No results returned from sync")
            print("\n__ETL_DONE__ success=false")
            sys.exit(1)
        
        success = all(r.get('success', False) for r in results.values())
        
        if success:
            print("\n[OK] Sync completed successfully!")
            for table_name, result in results.items():
                if result.get('skipped'):
                    print(f"   {table_name.upper()}: Skipped ({result.get('description', 'No description')})")
                else:
                    print(f"   {table_name.upper()}: {result.get('rows', 0)} rows synced")
            print("\n__ETL_DONE__ success=true")
            sys.exit(0)
        else:
            print("\n[ERROR] Sync failed!")
            for table_name, result in results.items():
                if not result.get('success'):
                    print(f"   {table_name.upper()}: {result.get('error', 'Unknown error')}")
            print("\n__ETL_DONE__ success=false")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n[FATAL] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        print("\n__ETL_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

