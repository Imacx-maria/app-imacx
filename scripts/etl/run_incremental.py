"""
Runner script for Incremental ETL (last 7 days)
- Imports SelectiveSync from scripts/etl_core/selective_sync.py
- Executes sync_incremental_7days()
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
    # Resolve project root (scripts/etl/run_incremental.py -> go up 2 levels)
    THIS_FILE = Path(__file__).resolve()
    PROJECT_ROOT = THIS_FILE.parents[2]

    # Ensure Python can import our core sync module
    CORE_DIR = PROJECT_ROOT / "scripts" / "etl_core"
    if str(CORE_DIR) not in sys.path:
        sys.path.insert(0, str(CORE_DIR))

    # Load environment variables from common locations
    try:
        from dotenv import load_dotenv  # type: ignore
        # Try project root .env first
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
            # Fallback to default search
            load_dotenv()
    except Exception:
        # If dotenv isn't available, continue; env may already be set by the host
        pass

    # Import after sys.path and env are prepared
    from selective_sync import SelectiveSync  # type: ignore

except Exception as bootstrap_err:
    print("Bootstrap error preparing ETL runner:", file=sys.stderr)
    traceback.print_exc()
    print("__ETL_DONE__ success=false")
    sys.exit(1)


def main() -> int:
    try:
        sync = SelectiveSync()
        results = sync.sync_incremental_year()

        success = False
        if isinstance(results, dict) and results:
            try:
                success = all(bool(v.get("success")) for v in results.values())
            except Exception:
                success = False
        elif results is True:
            # Some implementations might return True
            success = True
        else:
            success = False

        # Output raw results for debugging/observability
        try:
            print(json.dumps({
                "results": results,
                "project_root": str(PROJECT_ROOT),
            }, ensure_ascii=False))
        except Exception:
            # If results isn't JSON serializable, ignore
            pass

        # Emit completion marker for the API route to detect
        print(f"__ETL_DONE__ success={'true' if success else 'false'}")
        return 0 if success else 1

    except Exception:
        traceback.print_exc()
        print("__ETL_DONE__ success=false")
        return 1


if __name__ == "__main__":
    sys.exit(main())

