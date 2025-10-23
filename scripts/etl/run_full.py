"""
Runner script for Full ETL (last 1 year)
- Imports SelectiveSync from scripts/etl_core/selective_sync.py
- Executes sync_configured_tables()
- Prints a success marker that the Next.js API route scans for:
    __ETL_DONE__ success=true | false
Exit code: 0 on full success, 1 otherwise.
"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

try:
    THIS_FILE = Path(__file__).resolve()
    PROJECT_ROOT = THIS_FILE.parents[2]  # scripts/etl/run_full.py -> project root

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
        for p in env_paths:
            if p.exists():
                load_dotenv(dotenv_path=p)
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
        results = sync.sync_configured_tables()

        success = False
        if isinstance(results, dict) and results:
            try:
                success = all(bool(v.get("success")) for v in results.values())
            except Exception:
                success = False
        elif results is True:
            success = True
        else:
            success = False

        try:
            print(json.dumps({
                "results": results,
                "project_root": str(PROJECT_ROOT),
            }, ensure_ascii=False))
        except Exception:
            pass

        print(f"__ETL_DONE__ success={'true' if success else 'false'}")
        return 0 if success else 1

    except Exception:
        traceback.print_exc()
        print("__ETL_DONE__ success=false")
        return 1


if __name__ == "__main__":
    sys.exit(main())

