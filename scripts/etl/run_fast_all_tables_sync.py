"""
Runner script for fast ALL tables ETL using watermarks (last 3 days)

Steps:
- Imports SelectiveSync from scripts/etl_core/selective_sync.py
- Executes sync_fast_all_tables_3days()
- Syncs CL, BO, BI, FT, FO tables with 3-day overlap
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
    PROJECT_ROOT = THIS_FILE.parents[2]  # scripts/etl/run_fast_all_tables_sync.py -> project root

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

    from selective_sync import SelectiveSync  # type: ignore

except Exception:
    traceback.print_exc()
    print("__ETL_DONE__ success=false")
    sys.exit(1)


def main() -> int:
    try:
        sync = SelectiveSync()
        results = sync.sync_fast_all_tables_3days()

        success = False
        if isinstance(results, dict) and results:
            try:
                success = all(bool(item.get("success")) for item in results.values())
            except Exception:
                success = False

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

    except Exception:
        traceback.print_exc()
        print("__ETL_DONE__ success=false")
        return 1


if __name__ == "__main__":
    sys.exit(main())

