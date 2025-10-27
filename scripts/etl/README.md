# ETL – Minimal runners for Analytics and Produção

This project has many ETL helpers. To keep things simple for your two pages, use only the scripts below.

Essential scripts kept in this folder:

1) Analytics page (`app/gestao/analytics/page.tsx`)
- `scripts/etl/run_fast_all_tables_sync.py` → updates `phc.ft` (invoices) and other tables for last 3 days; recreates views
- `scripts/etl/run_today_bo_bi.py` → updates `phc.bo` (FO/Orçamentos) and `phc.bi` (lines) for today; recreates views
- `scripts/etl/run_annual_historical.py` → refreshes `phc.2years_ft`, `phc.2years_bo`, `phc.2years_fi` used by rankings; recreates views

2) Produção page (`app/producao/page.tsx`)
- `scripts/etl/run_today_bo_bi.py` → ensures FO headers (`phc.bo`) and lines (`phc.bi`) are up-to-date for imports
- `scripts/etl/run_today_clients.py` → refreshes clients (`phc.cl`) for combobox and name resolution
- `scripts/etl/post_sync_views.py` → recreates `phc.folha_obra_with_orcamento` view; runs automatically after the runners above

Commands (Windows PowerShell):

- Update last 3 days (all core tables):
  ```powershell
  python scripts/etl/run_fast_all_tables_sync.py
  ```
- Today-only BO/BI/CL (fast intraday):
  ```powershell
  python scripts/etl/run_today_bo_bi.py
  ```
- Today-only Clients:
  ```powershell
  python scripts/etl/run_today_clients.py
  ```
- Refresh 2-year snapshot (ranking RPC):
  ```powershell
  python scripts/etl/run_annual_historical.py
  ```

Note: All runners print `__ETL_DONE__ success=true|false`. On success they also call `post_sync_views.py` to keep `phc.folha_obra_with_orcamento` in sync.

UI Buttons & .env configuration

- The UI triggers `/api/etl/incremental`, `/api/etl/full`, and `/api/etl/annual-update`.
- Production deployments (Linux/serverless) cannot run Python locally. Configure:
  - `ETL_SYNC_URL` → external service that executes these Python runners (Windows host recommended).
  - `ETL_API_KEY` → optional bearer token used by the API routes.
- Local development no Windows (servidor Next.js):
  - `ETL_SCRIPTS_PATH` → defina caminho relativo, p.ex. `scripts/etl`.
  - `PYTHON_PATH` → opcional, por defeito `python`. Se usar o launcher do Windows, defina `PYTHON_PATH=py` e `PYTHON_ARGS=-3` (em vez de `py -3`).
- If a Windows absolute path is set in `ETL_SCRIPTS_PATH` and the server runs on Linux, the API will return a helpful error instead of failing.

Valid incremental types from the UI

- `today_bo_bi` → runs `run_today_bo_bi.py`
- `today_clients` → runs `run_today_clients.py`
- `fast_all` → runs `run_fast_all_tables_sync.py`
- `default` → maps to `fast_all` for a short, safe catch‑all

External service example (cURL)

```bash
curl -X POST "${ETL_SYNC_URL}/etl/incremental" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ETL_API_KEY}" \
  -d '{"type":"today_bo_bi"}'
```