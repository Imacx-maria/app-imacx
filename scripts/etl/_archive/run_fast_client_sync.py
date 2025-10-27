"""
Fast sync for Clientes only - Last 3 days
This is a simplified version that syncs just the client table with recent changes.

Emits a single completion marker that the Next.js API route listens for:
    __ETL_DONE__ success=true | false
Exit code: 0 on success, 1 otherwise.
"""
import sys
import traceback
from pathlib import Path

try:
    # Find the right path for ETL core
    THIS_FILE = Path(__file__).resolve()
    PROJECT_ROOT = THIS_FILE.parents[2]  # scripts/etl/run_fast_client_sync.py -> project root
    
    CORE_DIR = PROJECT_ROOT / "scripts" / "etl_core"
    if str(CORE_DIR) not in sys.path:
        sys.path.insert(0, str(CORE_DIR))

    # Import the selective sync class
    from selective_sync import SelectiveSync

except Exception:
    traceback.print_exc()
    print("__ETL_DONE__ success=false")
    sys.exit(1)

def main() -> int:
    """Fast sync for client data only"""
    try:
        print("🏃 Fast sync: Clients only (last 3 days)")
        sync = SelectiveSync()
        
        # Use the optimized fast client sync
        success = sync.sync_fast_clients_3days()
        
        if success:
            print("__ETL_DONE__ success=true")
            return 0
        else:
            print("__ETL_DONE__ success=false")
            return 1
            
    except Exception as e:
        traceback.print_exc()
        print("__ETL_DONE__ success=false")
        return 1

if __name__ == "__main__":
    sys.exit(main())

