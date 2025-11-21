# GEMINI.md - Project Context for Gemini CLI

This document provides a comprehensive overview of the `imacx-clean` project, its architecture, and development conventions to be used as a context for Gemini CLI.

## Project Overview

`imacx-clean` is a web application built with Next.js 14.2 (App Router) and TypeScript. It serves as an internal tool for managing production, inventory, logistics, and administrative tasks. The application is divided into several domain areas:

*   `/producao`: Production management.
*   `/stocks`: Inventory and analytics.
*   `/gestao`: Logistics, billing, and financial analytics.
*   `/definicoes`: Admin settings.
*   `/designer-flow`: Design workflow.

### Tech Stack

*   **Framework**: Next.js 14.2 (App Router)
*   **Language**: TypeScript (strict mode)
*   **Styling**: Tailwind CSS with a global design system. All UI styling must follow the official design system located at `.cursor/rules/design-system.md`.
*   **UI Components**: Radix UI primitives and shadcn patterns.
*   **Authentication**: Supabase (Auth + PostgreSQL)
*   **Database**: MSSQL via PHC integration and PostgreSQL via Supabase.
*   **Data Visualization**: Recharts for dashboards.

## Building and Running

The following scripts are available in `package.json`:

*   `pnpm dev`: Starts the development server.
*   `pnpm build`: Builds the application for production.
*   `pnpm start`: Starts a production server.
*   `pnpm lint`: Lints the codebase.
*   `pnpm analyze`: Analyzes the bundle size.

## Development Conventions

### Styling & Design System

*   All UI styling must strictly follow the official design system defined in `.cursor/rules/design-system.md`.
*   **Zero hardcoded styling rules.** Use the design system for colors, typography, borders, radii, and component variants.
*   Always test both light and dark themes.

### File and Directory Structure

*   **Documentation:** All documentation is located in the `TEMP/docs/` directory, categorized by topic. The main index is `TEMP/docs/README.md`.
*   **Scripts:** Automation and utility scripts are in the `scripts/` directory.
*   **Archives:** Old or completed documentation is moved to `TEMP/_archived/`.
*   The project root should remain clean, containing only permanent configuration files.

### Authentication & Permissions

*   Always use `getUser()` instead of `getSession()` for authentication.
*   Middleware is responsible for JWT validation, fetching fresh permissions, and redirecting unauthorized users.
*   Client-side permissions are handled via `PermissionsProvider` and the `hasPermission()` function.

### Database Conventions

*   PHC tables must always use the schema syntax: `supabase.schema('phc').from('ft')`.
*   Always filter out cancelled invoices: `WHERE anulado = false`.
*   **BiStamp Linking:** There is no direct foreign key from invoices (FI) to quotes (BO). Use the `bi` table as a bridge. See `CLAUDE.md` for a detailed explanation.

### ETL / Data Sync Rules

*   Before running any ETL script, read the reference guide at `scripts/etl/README_ETL_SCRIPTS.md`.
*   ETL scripts are located in `scripts/etl/`.
*   After any schema changes, a full refresh (`run_full.py` and `run_annual_historical.py`) is required. Do not use the fast sync in this case.

### Component & Code Conventions

*   Components should rely on the design system for styling.
*   Avoid inline colors and unnecessary prop duplication.
*   Use `shadcn` patterns for UI components.
*   Lazy load drawer components.
*   Use `useMemo`, `useCallback`, and `React.memo` where appropriate to optimize performance.

### Date Period Definitions

*   **NEVER hardcode dates.** Always use dynamic date calculations for periods like Month-to-Date (MTD) and Year-to-Date (YTD).
*   When comparing to previous years, always use the same day-of-year period.

### Financial Analysis

*   Before working on `/gestao/analise-financeira`, refer to `PHASE2_CRITICAL_LEARNINGS.md` and `PHASE2_QUICK_REFERENCE.md`.
*   Notas de Crédito are already negative; do not multiply their values.
*   The Supabase row limit is 1000; use RPC for large aggregates.
