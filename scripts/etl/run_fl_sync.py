"""
Runner script for FL (Suppliers) table sync

Steps:
- Imports SelectiveSync from scripts/etl_core/selective_sync.py
- Syncs only FL table (active suppliers where INACTIVO = 0)
- Emits completion marker understood by API routes:
    __ETL_DONE__ success=true | false
Exit code: 0 on success, 1 otherwise.
"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

try:
    THIS_FILE = Path(__file__).resolve()
    PROJECT_ROOT = THIS_FILE.parents[2]  # scripts/etl/run_fl_sync.py -> project root

    CORE_DIR = PROJECT_ROOT / "scripts" / "etl_core"
    if str(CORE_DIR) not in sys.path:
        sys.path.insert(0, str(CORE_DIR))

    try:
        from dotenv import load_dotenv  # type: ignore

        env_paths = [
            PROJECT_ROOT / ".env.local",
            PROJECT_ROOT / ".env",
            PROJECT_ROOT / "config" / ".env.local",
            PROJECT_ROOT / "config" / ".env",
        ]
        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(dotenv_path=env_path)
                break
        else:
            load_dotenv()
    except Exception:
        pass

    from selective_sync import SelectiveSync, TABLE_CONFIGS  # type: ignore

except Exception:
    traceback.print_exc()
    print("__ETL_DONE__ success=false")
    sys.exit(1)


def main() -> int:
    try:
        print("[FL SYNC] Starting FL (Suppliers) table sync...")

        sync = SelectiveSync()

        # Check if FL config exists
        if 'fl' not in TABLE_CONFIGS:
            print("[ERROR] FL table configuration not found in TABLE_CONFIGS")
            print("__ETL_DONE__ success=false")
            return 1

        # Connect to databases
        if not sync.connect_phc() or not sync.connect_supabase():
            print("[ERROR] Failed to connect to databases")
            print("__ETL_DONE__ success=false")
            return 1

        try:
            # Sync FL table
            config = TABLE_CONFIGS['fl']
            success, row_count = sync.sync_table_selective('fl', config)

            results = {
                'fl': {
                    'success': success,
                    'rows': row_count,
                    'description': config['description']
                }
            }

            payload = {
                "project_root": str(PROJECT_ROOT),
                "results": results,
            }

            try:
                print(json.dumps(payload, ensure_ascii=False))
            except Exception:
                print(json.dumps({"project_root": str(PROJECT_ROOT)}, ensure_ascii=False))

            print(f"__ETL_DONE__ success={'true' if success else 'false'}")
            return 0 if success else 1

        finally:
            sync.close_connections()

    except Exception:
        traceback.print_exc()
        print("__ETL_DONE__ success=false")
        return 1


if __name__ == "__main__":
    sys.exit(main())
