# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Temporary docs → TEMP/docs/

Utility or automation scripts → scripts/

Project root stays clean (only permanent config files)

Before Claude creates a new file:

Check if it exists

If it does, update it

If not, create it in the correct folder

✔ B. No guessing folder structure

If unsure where a file goes, choose:

TEMP/docs/   (for markdown)
scripts/      (for code)

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

🔁 6. ETL / Data Sync Rules

Scripts live in:

scripts/etl/


Important runners:

run_fast_all_tables_sync.py — last 3 days

run_today_bo_bi.py

run_today_clients.py

run_annual_historical.py

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

🔎 9. General Behavior for Claude Code

Fix code using the design-system rules, not guesswork

Apply consistent patterns across components

Improve readability and structure without stylistic invention

When refactoring, maintain functional behavior

Prefer smaller, clearer components

Avoid re-implementing logic already existing in utils/hooks

🧹 10. Golden Rules (short version)

Design-system.md controls all UI

PHC = .schema('phc') ALWAYS

Never hardcode styling

Never place docs/scripts in root

Always test light + dark themes

Respect financial logic constraints

Keep code clean, declarative, and consistent
