# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

🚨 0. Git & Repository Rules (ABSOLUTELY NON-NEGOTIABLE)

**READ THIS FIRST. EVERY TIME. NO EXCEPTIONS.**

⛔ **PROHIBITED ACTIONS - NEVER DO THESE:**

1. **NEVER run ANY git command** except `git status` and `git diff`
   - ❌ NO: `git checkout`, `git switch`, `git branch`, `git merge`
   - ❌ NO: `git push`, `git pull`, `git fetch`, `git clone`
   - ❌ NO: `git commit`, `git add`, `git reset`, `git revert`
   - ❌ NO: `git stash`, `git cherry-pick`, `git rebase`
   - âœ… YES: `git status`, `git diff` (read-only only)

2. **NEVER fetch or pull code from GitHub/remote**
   - If code is missing or wrong, STOP and explain the problem
   - User will manually restore if needed
   - Do NOT "helpfully" pull backups

3. **NEVER modify, overwrite, or regenerate CLAUDE.md**
   - This file controls your behavior
   - Treat it as read-only system configuration
   - If you think it needs changes, describe them and STOP

4. **NEVER assume branch or working directory**
   - Check `git status` output at conversation start
   - If working in worktree (e.g., `~/.claude-worktrees/...`), stay there
   - If uncertain, ASK before any file operations

🔴 **IF YOU MAKE A MISTAKE:**
- ❌ DO NOT pull from GitHub
- ❌ DO NOT change branches to "fix" it
- ❌ DO NOT restore backups
- âœ… STOP immediately
- âœ… Explain what went wrong
- âœ… Wait for user instruction

🔴 **IF YOU THINK A GIT ACTION WOULD HELP:**
- STOP
- Describe the EXACT command you recommend
- Explain WHY you think it's needed
- Wait for explicit "yes, do it" approval
- If unsure whether you have approval → you DON'T

⚖️ **CONFLICT RESOLUTION:**
If any other instruction conflicts with these rules:
👉 **THESE RULES WIN. ALWAYS.**

No "but the user seemed to want...", no "I was trying to help", no "I thought it was implied".

**When in doubt: STOP and ASK.**

🎨 1. Styling & Design System (Single Rule)

All UI styling must follow the official design system:

C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean\.cursor\rules\design-system.md


This file is the only source of truth for:

colors

typography

borders

radii

component variants

hover/active rules

dark/light mode

zero hardcoded styling rules

If there is EVER a conflict:
👉 design-system.md wins.

Claude must always read it, follow it, and enforce it across the entire project.

Do NOT replicate its content in this file.
Do NOT override it.
Do NOT “interpret creatively.”
Do NOT introduce new colors, borders, or visual patterns.

🧭 2. Repository Behavior Rules
✔ A. File placement

**Documentation:** TEMP/docs/ is now organized by category:

TEMP/docs/
├── README.md              # Start here - documentation index
├── architecture/          # System design, ETL, security
├── features/             # Feature implementations
├── business/             # Company, strategy, pricing
└── analysis/             # UX analysis, research

**Scripts:** scripts/ for all automation and utility code

**Archives:** TEMP/_archived/ for old/completed documentation

Project root stays clean (only permanent config files)

✔ C. Supabase migrations housekeeping

- Keep only the active, unapplied SQL files inside `supabase/migrations/`
- After a migration has been applied everywhere and pushed, move it to `supabase/migrations_archive_YYYYMMDD/` (current folder: `supabase/migrations_archive_20250118/`) to keep the working directory tidy
- If you need to provision a fresh environment, restore archived migrations (or replay them manually) in their original chronological order before running new ones

Before Claude creates a new file:

1. Check if it exists
2. If it does, update it
3. If not, determine correct category:
   - Architecture docs → TEMP/docs/architecture/
   - Feature docs → TEMP/docs/features/
   - Business docs → TEMP/docs/business/
   - Analysis → TEMP/docs/analysis/
   - Completed/obsolete → TEMP/_archived/YYYY-MM/

✔ B. Documentation best practices

**Always check the documentation index first:**

TEMP/docs/README.md

This file contains the complete catalog of all active documentation.

**When creating new documentation:**
- Use clear, descriptive filenames
- Include date in document header
- Add entry to TEMP/docs/README.md
- Choose appropriate category folder

**When a document becomes obsolete:**
- Move to TEMP/_archived/YYYY-MM/appropriate-subfolder/
- Remove from or mark as deprecated in README.md

🗺 3. App Architecture Summary

Tech Stack

Next.js 14.2 (App Router)

TypeScript (strict)

Tailwind CSS (with global design system)

Radix UI primitives

Supabase (auth + PostgreSQL)

MSSQL via PHC integration

Recharts (dashboards)

Domain Areas

/producao — Production

/stocks — Inventory & analytics

/gestao — Logistics, billing, financial analytics

/definicoes — Admin settings

/designer-flow — Design workflow

🔐 4. Authentication & Permissions
✔ Always use getUser() (NOT getSession())
✔ Middleware must:

Validate JWT

Fetch fresh permissions

Redirect unauthorized users

✔ Permissions come from:

roles table

page_permissions array

Supports hierarchical path matching

✔ Client-side usage:

Access via PermissionsProvider

Always check hasPermission() before rendering protected UI

🗄 5. Database Conventions
✔ PHC tables ALWAYS use schema syntax

Correct:

supabase.schema('phc').from('ft')


Wrong:

supabase.from('phc.ft')

✔ ft and 2years_ft are different — never mix them.
✔ Always filter out cancelled invoices:
WHERE anulado = false

🔗 5.1 BiStamp Linking (Quote-to-Invoice) — CRITICAL

**The Problem:**
There is NO direct foreign key from invoices (FI) to quotes (BO).

**The Solution: BiStamp Chain**
Use the `bi` table as a bridge:

```
FI (Invoice) → BI (Bridge) → BO (Quote)
    ↓              ↓            ↓
 bistamp      line_id      document_id
```

**Current Year:**
```sql
fi.bistamp → bi.line_id
bi.document_id → bo.document_id
```

**Historical (Previous Years):**
```sql
2years_fi.bistamp → bi.line_id
bi.document_id → 2years_bo.document_id
```

**CRITICAL LIMITATION:**
- ✅ Can trace: Invoice → Quote (via BiStamp)
- ❌ Cannot trace: Quote → Invoice (no reverse lookup)
- **You can ONLY find quote numbers when an invoice exists**
- Unconverted quotes have no bistamp link

**Conversion Rate Calculation:**
- Total quotes = Query BO/2years_bo directly
- Converted quotes = Count via FI → BI → BO chain
- Rate = (converted / total) × 100

**Why This Matters:**
This was extremely difficult to discover and is not bidirectional. Always use the BiStamp chain when linking invoices to quotes for department analysis, conversion tracking, or any quote-to-invoice metrics.

🔁 6. ETL / Data Sync Rules

**CRITICAL:** Before running any ETL script, read the complete reference guide:

scripts/etl/README_ETL_SCRIPTS.md

This document contains detailed descriptions, use cases, and decision trees for all ETL scripts.

Scripts live in:

scripts/etl/


Main ETL Scripts (in order of most common use):

**Full Refresh (use after schema changes):**
- `run_full.py` — Full sync (last 1 year, DROPS & RECREATES tables)
- `run_annual_historical.py` — Historical sync (last 2 complete years for YoY)

**Daily/Incremental Syncs:**
- `run_fast_all_tables_sync.py` — Incremental (last 3 days only)
- `run_today_bo_bi.py` — Today's quotes only
- `run_today_clients.py` — Today's customers only
- `run_incremental_year.py` — Catch-up sync using watermarks

**⚠️ CRITICAL RULE:**
After adding new columns to table configs (e.g., bistamp), you MUST run:
1. `python scripts/etl/run_full.py` (not the fast sync!)
2. `python scripts/etl/run_annual_historical.py`

Never use `run_fast_all_tables_sync.py` after schema changes - it only syncs last 3 days and won't populate historical data.

Production may use GitHub Actions for ETL.

All ETL tasks must end with:

__ETL_DONE__ success=true|false

🧩 7. Component & Code Conventions
✔ General

Components should rely on the design system for styling

No inline colors

Avoid unnecessary prop duplication

Use shadcn patterns for UI components

✔ Performance

Lazy load drawer components

Use useMemo, useCallback, React.memo when needed

Use bundle analysis tools when build size grows

✔ Tables

Internal row borders only

No wrapper border

Use design system variables for text and backgrounds

✔ Buttons

Use variant system (default, destructive, outline, ghost)

Icon buttons use size="icon"

📌 8. Financial Analysis (Phase 2) — Critical Notes

Before touching anything in /gestao/analise-financeira, Claude must read:

PHASE2_CRITICAL_LEARNINGS.md

PHASE2_QUICK_REFERENCE.md

Key rules:

Notas de Crédito are already negative → do not multiply values

Supabase row limit = 1000, use RPC for large aggregates

YTD means same calendar period, not full-year vs YTD

📅 9. Date Period Definitions (CRITICAL - READ THIS)

NEVER hardcode dates. ALWAYS use dynamic date calculations.

**Month-to-Date (MTD)**
- Definition: From the 1st day of the current month to system date (CURRENT_DATE)
- Example: If today is November 15, 2025:
  - Current MTD: 2025-11-01 to 2025-11-15
  - Previous Year Same Period: 2024-11-01 to 2024-11-15
  - Previous Year Same Period (2 years ago): 2023-11-01 to 2023-11-15
- SQL Implementation:
  ```sql
  -- Current MTD
  WHERE date_field >= DATE_TRUNC('month', CURRENT_DATE)
    AND date_field <= CURRENT_DATE
  
  -- Previous Year Same Period
  WHERE date_field >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')
    AND date_field <= (CURRENT_DATE - INTERVAL '1 year')
  ```

**Year-to-Date (YTD)**
- Definition: From January 1st of the current year to system date (CURRENT_DATE)
- Example: If today is November 15, 2025:
  - Current YTD: 2025-01-01 to 2025-11-15
  - Previous Year Same Period: 2024-01-01 to 2024-11-15
  - Previous Year Same Period (2 years ago): 2023-01-01 to 2023-11-15
- SQL Implementation:
  ```sql
  -- Current YTD
  WHERE date_field >= DATE_TRUNC('year', CURRENT_DATE)
    AND date_field <= CURRENT_DATE
  
  -- Previous Year Same Period
  WHERE date_field >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
    AND date_field <= (CURRENT_DATE - INTERVAL '1 year')
  ```

**Golden Rule for Period Comparisons**
- When comparing to previous years, ALWAYS use the SAME DAY-OF-YEAR period
- If today is day 320 of the year, compare to day 320 of previous years
- NEVER compare full year to YTD (that's apples to oranges)

🔎 10. General Behavior for Claude Code

Fix code using the design-system rules, not guesswork

Apply consistent patterns across components

Improve readability and structure without stylistic invention

When refactoring, maintain functional behavior

Prefer smaller, clearer components

Avoid re-implementing logic already existing in utils/hooks

🧹 11. Golden Rules (short version)

Design-system.md controls all UI

PHC = .schema('phc') ALWAYS

Never hardcode styling

Never place docs/scripts in root

Always test light + dark themes

Respect financial logic constraints

Keep code clean, declarative, and consistent

📚 12. Documentation Hub

**All project documentation is organized and indexed here:**

TEMP/docs/README.md

**Categories:**
- 🏗️ Architecture (ETL, Security, System Design)
- ✨ Features (Implementation Guides)
- 💼 Business (Strategy, Pricing, Company Info)
- 🔍 Analysis (UX, Research)

**Before creating documentation:**
1. Check TEMP/docs/README.md to see if similar doc exists
2. Choose appropriate category folder
3. Add entry to README.md index
4. Include date and status in document

**Key Documentation to Know:**
- ETL Scripts: scripts/etl/README_ETL_SCRIPTS.md
- Design System: .cursor/rules/design-system.md
- Quote-Invoice Linking: TEMP/docs/architecture/QUOTE_INVOICE_LINKING_IMPLEMENTATION.md
- Security: TEMP/docs/architecture/SECURITY_AUDIT_REPORT.md
