"""
Run today-only sync for clients (CL table)
Syncs data from today 00:00:00 onwards
"""

import sys
from pathlib import Path

# Add etl_core to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'etl_core'))

from selective_sync import SelectiveSync

def main():
    print("⚡ Starting today-only sync for clients...")
    
    syncer = SelectiveSync()
    results = syncer.sync_today_clients()
    
    success = all(r.get('success', False) for r in results.values())
    
    if success:
        print("\n✅ Sync completed successfully!")
        for table_name, result in results.items():
            if result.get('skipped'):
                print(f"   {table_name.upper()}: Skipped ({result.get('description', 'No description')})")
            else:
                print(f"   {table_name.upper()}: {result.get('rows', 0)} rows synced")
        print(f"\n__ETL_DONE__ success=true")
        sys.exit(0)
    else:
        print("\n❌ Sync failed!")
        for table_name, result in results.items():
            if not result.get('success'):
                print(f"   {table_name.upper()}: {result.get('error', 'Unknown error')}")
        print(f"\n__ETL_DONE__ success=false")
        sys.exit(1)

if __name__ == "__main__":
    main()

