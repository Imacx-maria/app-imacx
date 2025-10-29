"""
Run today-only sync for BO/BI/CL tables (fastest for intraday updates)
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
        print(">> Starting today-only sync for BO/BI/CL (from midnight)...")
        
        syncer = SelectiveSync()
        results = syncer.sync_today_bo_bi()
        
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
            # Recreate views after successful sync
            print("\n[VIEW] Recreating database views...")
            try:
                import subprocess
                PROJECT_ROOT = Path(__file__).resolve().parents[2]
                post_sync_script = PROJECT_ROOT / "scripts" / "etl" / "post_sync_views.py"
                if post_sync_script.exists():
                    result = subprocess.run(
                        [sys.executable, str(post_sync_script)],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    print(result.stdout)
                    if result.returncode != 0:
                        print(f"[WARN] View recreation failed: {result.stderr}")
                else:
                    print(f"[WARN] Post-sync script not found: {post_sync_script}")
            except Exception as e:
                print(f"[WARN] Error running post-sync views: {e}")
                # Don't fail the whole ETL if view recreation fails
                import traceback
                traceback.print_exc()
            
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

