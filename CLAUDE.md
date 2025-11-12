# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

IMACX is a Next.js 14.2 manufacturing management system for production, inventory, logistics, and design workflow coordination. The application is Portuguese-language and integrates with Supabase (auth + database) and PHC (Portuguese business software) for order synchronization.

**Key Business Domains:**
- `/producao` - Production job management and operations tracking
- `/stocks` - Inventory management with analytics
- `/gestao` - Logistics, billing, and analytics dashboards
- `/definicoes` - Administrative settings (machines, materials, holidays, warehouses)
- `/designer-flow` - Design workflow and planning interface

## Development Commands

```bash
# Development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm lint

# Bundle analysis (creates interactive size visualization)
ANALYZE=true npm run build
```

## Architecture

### Core Stack
- **Framework:** Next.js 14.2 with App Router
- **Language:** TypeScript (strict mode)
- **Database:** Supabase (PostgreSQL) + legacy MSSQL support
- **Authentication:** Supabase Auth with JWT validation
- **Styling:** Tailwind CSS with custom design system
- **UI Components:** Radix UI primitives (headless components)
- **Charts:** Recharts for analytics dashboards
- **External Integration:** PHC system via API routes (`/app/api/phc`)

### Authentication & Security

**Two-Layer Security Model:**

1. **Middleware Layer** (`middleware.ts`):
   - Uses `getUser()` (not `getSession()`) for secure server-side JWT validation
   - Validates JWT against hardcoded Supabase project ID
   - Fetches fresh permissions from database on every request
   - Redirects unauthorized users to `/login` or `/dashboard`
   - Public routes: `/login`, `/reset-password`, `/update-password`

2. **Client Layer** (`providers/PermissionsProvider.tsx`):
   - React context exposing `hasPermission()` and `canAccessPage()` hooks
   - Used for conditional UI rendering based on permissions
   - Caches permissions in React state during session

**Role-Based Access Control (RBAC):**
- Four roles: `ADMIN`, `DESIGNER`, `OP_STOCKS`, `OP_PRODUCAO`
- Admin wildcard (`*`) grants all permissions
- Dashboard always accessible to authenticated users
- Permissions stored as `page_permissions` array in `roles` table
- Path matching supports hierarchical permissions (e.g., `definicoes` allows `definicoes/utilizadores`)

**Security Notes:**
- Always use `getUser()` for auth validation (never `getSession()`)
- Never cache permissions in headers (cache poisoning risk)
- TODO: Consider server-side Redis cache with proper invalidation

### Data Layer

**Supabase Client Utilities:**
- `utils/supabase.ts` - Browser client factory (`createBrowserClient`)
- `utils/supabaseAdmin.ts` - Server client with service role (admin operations)
- `middleware.ts` uses `createMiddlewareClient` for auth validation

**Database Structure:**
- **User Management:** `profiles` (links to `auth.users`), `roles`, `permissions`
- **Production:** `production_jobs`, `production_operations`, `production_items`
- **Stock:** `current_stock`, `stock_entries`, `materiais`
- **Settings:** `maquinas`, `feriados`, `armazens`, `transportadoras`
- **PHC Integration:** `phc.bo` (orders), `phc.bi` (order lines), `phc.ft` (invoices), `phc.cl` (clients)

**Migrations:**
- Stored in `/supabase/migrations/`
- Applied via `supabase db push` (requires Supabase CLI)
- Include RLS policies for security

### Type System

**Centralized Type Definitions:**
- `types/producao.ts` - Production workflows (Job, Item, ProductionOperation, OperationType enum)
- `types/permissions.ts` - ROLES and PERMISSIONS constants with typed IDs
- `types/logistica.ts` - Logistics and delivery tracking types

**Type Conventions:**
- Strict TypeScript mode enabled
- Enums for operation types (e.g., `OperationType.CORTE`, `OperationType.QUINAGEM`)
- Complex business logic types (job grouping, batch operations, planned vs executed quantities)

### Component Organization

**Directory Structure:**
- `/components/ui` - Base Radix UI components (Button, Input, Table, Dialog, etc.)
- `/components/producao` - Production-specific components (JobDrawer)
- `/components/stocks` - Stock management components
- `/components/dashboard` - Dashboard widgets
- `/components/custom` - Shared custom components (Combobox, DatePicker, ActionButtons)

**Reusable Patterns:**
- Custom form components extend Radix primitives
- Data tables with filtering, sorting, pagination
- Drawer pattern for detail views (read-only vs editable modes)

### Design System (v3.2)

**CRITICAL: Global CSS-First Architecture**

All styling is controlled by `globals.css` using CSS variables and element selectors. Components are **markup-only** with **zero color classes**.

**Core Principles:**
1. **Global CSS First** - All styling in `globals.css` using element selectors
2. **CSS Variables Only** - Single source of truth for all colors
3. **Zero Hardcoded Colors** - Theme-aware by default
4. **Minimal Specificity** - Components are markup-only, no inline color classes
5. **Sharp Corners** - `border-radius: 0 !important` everywhere
6. **No Focus Rings** - Clean, minimal outlines

**Typography:**
- Font: Atkinson Hyperlegible (accessibility-focused)
- Universal uppercase (`text-transform: uppercase !important`)
- No bold text anywhere (`font-weight: 400 !important`)
- Exception: Login page uses normal case

**Color System (CSS Variables):**

```css
/* Light Mode */
--background: oklch(0.94 0.01 95.04);     /* Light beige */
--foreground: oklch(0% 0 0);              /* Black */
--border: oklch(0% 0 0);                  /* Black */
--input: oklch(0.87 0.03 83.3 / 0.3);     /* Brownish input background */
--primary: oklch(84.08% 0.1725 84.2);     /* Yellow */
--primary-foreground: oklch(0% 0 0);      /* Black */
--orange: oklch(0.70 0.17 50);            /* Orange for calendar/selected states */

/* Dark Mode */
--background: oklch(0.31 0 0);            /* Dark gray */
--foreground: oklch(0.85 0 0);            /* Light gray (softer on eyes) */
--border: oklch(0.50 0 0);                /* Medium gray (visible!) */
--input: oklch(0.45 0 0);                 /* Dark input */
--accent: oklch(0.40 0 0);                /* Dark gray hover */
--accent-foreground: oklch(0.85 0 0);     /* Light text on dark hover */
```

**Component Rules:**

```tsx
// ✅ CORRECT: Let global CSS handle everything
<Input placeholder="Código" />
<Button variant="default">Primary</Button>
<Checkbox />

// ❌ WRONG: Don't add color classes
<Input className="bg-[#dedcd4] text-black" />
<Button className="bg-primary text-black">Primary</Button>
```

**Button Standards:**
- Delete: `variant="destructive"` (red background, black text)
- Edit/View/Copy/Add/Notas: `variant="default"` (yellow background, black text)
- Refresh/Utilities: `variant="outline"` (outlined)
- All buttons have visible 1px border
- Icon buttons: `size="icon"` with `className="h-10 w-10"`
- Icon size: `className="h-4 w-4"`

**Edit vs View Buttons:**
- Edit (Pencil ✏️): Opens editable forms/drawers
- View (Eye 👁️): Opens read-only drawers
- Never use both for the same item (choose one)
- Action column order: Edit/View → Copy → Delete

**Table Styling:**
- **NO outside borders** - only internal row borders (`border-b`)
- Headers: Yellow background + black text (automatic via global CSS)
- Hover: Brownish background (same as input fields)
- Global CSS handles all styling

**Calendar (DayPicker):**
- Selected days: Orange background (`var(--orange)`) with **black text**
- Today: Orange background with **black text** (both themes)
- Weekends: Light gray background (`var(--input)`)
- Holidays: Darker gray than weekends (`var(--calendar-holiday-bg)`)
- No blue outlines or focus rings

**Filter Bars (Standard Pattern):**
```tsx
<div className="flex items-center gap-2">
  <Input placeholder="FILTRAR POR FO..." className="h-10 w-[110px]" maxLength={6} />
  <Input placeholder="FILTRAR POR MATERIAL..." className="h-10 flex-1" />
  <Button variant="outline" size="icon" className="h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black">
    <XSquare className="h-4 w-4" />
  </Button>
</div>
```

**Testing Checklist:**
- [ ] Test in both light and dark mode
- [ ] Verify borders are visible (especially dark mode)
- [ ] Check hover states provide clear feedback
- [ ] Verify tables have NO outside borders
- [ ] Ensure yellow/orange elements always have black text

**See `.cursor/rules/design-system.mdc` for complete design system documentation.**

## ETL Integration

The app synchronizes data from PHC (MSSQL) to Supabase (PostgreSQL) using Python ETL scripts in `/scripts/etl/`.

**Essential ETL Scripts:**

```bash
# Update last 3 days (all core tables)
python scripts/etl/run_fast_all_tables_sync.py

# Today-only BO/BI (fast intraday)
python scripts/etl/run_today_bo_bi.py

# Today-only clients
python scripts/etl/run_today_clients.py

# Refresh 2-year historical snapshot (rankings)
python scripts/etl/run_annual_historical.py
```

**ETL API Routes:**
- `/api/etl/incremental` - Triggers incremental sync (types: `today_bo_bi`, `today_clients`, `fast_all`)
- `/api/etl/full` - Full table sync
- `/api/etl/annual-update` - 2-year historical snapshot

**Environment Configuration:**
- Local Windows: Set `ETL_SCRIPTS_PATH=scripts/etl` and `PYTHON_PATH=python`
- Production/Linux: Set `ETL_SYNC_URL` to external Windows service or use GitHub Actions
- GitHub Actions: Set `GH_TOKEN`, `GH_REPO_OWNER`, `GH_REPO_NAME` for automated workflows

**Post-Sync Views:**
- All ETL runners automatically call `post_sync_views.py` to refresh `phc.folha_obra_with_orcamento`
- Runners print `__ETL_DONE__ success=true|false` for monitoring

## Hooks and Custom Logic

**Production Hooks** (`app/producao/hooks/`):
- `useProducaoJobs.ts` - Fetch and filter production jobs
- `useJobStatus.ts` - Calculate job completion status
- `usePhcIntegration.ts` - PHC order import logic

**Shared Utilities:**
- `utils/producao/dateHelpers.ts` - Date formatting and parsing
- `utils/producao/sortHelpers.ts` - Table sorting logic
- `utils/producao/statusColors.ts` - Status badge color mapping
- `utils/exportProducaoToExcel.ts` - Excel export with ExcelJS
- `utils/auditLogging.ts` - Database audit trail helpers

## Code Patterns

### API Route Pattern

```typescript
import { createServerClient } from '@/utils/supabaseAdmin'

export async function GET(request: Request) {
  const supabase = createServerClient()

  // Always validate auth with getUser()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch data
  const { data, error: dbError } = await supabase
    .from('table_name')
    .select('*')

  if (dbError) {
    return Response.json({ error: dbError.message }, { status: 500 })
  }

  return Response.json(data)
}
```

### Component Pattern

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'

export default function ExamplePage() {
  const [data, setData] = useState([])
  const supabase = createBrowserClient()

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('table_name').select('*')
      setData(data || [])
    }
    fetchData()
  }, [])

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl text-foreground">TITLE</h1>
      <p className="text-muted-foreground mt-2">Subtitle</p>
      {/* Content - NO color classes */}
    </div>
  )
}
```

### Permission Check Pattern

```typescript
import { usePermissions } from '@/providers/PermissionsProvider'

export default function ProtectedComponent() {
  const { hasPermission } = usePermissions()

  if (!hasPermission('producao')) {
    return <p>No access</p>
  }

  return <div>Protected content</div>
}
```

## Common Gotchas

1. **Never use `getSession()` for auth** - Always use `getUser()` for server-side validation
2. **Never hardcode colors** - Use CSS variables and let `globals.css` handle styling
3. **Never add `border` class to table wrappers** - Tables have NO outside borders
4. **Always test dark mode** - Toggle theme and verify borders/text are visible
5. **ETL on Linux requires external service** - Python scripts run only on Windows locally
6. **Permission caching removed** - Middleware fetches fresh permissions (prevent cache poisoning)
7. **Orange/Yellow always use black text** - No exceptions, even in dark mode
8. **Uppercase is universal** - All text except login page uses `text-transform: uppercase`
9. **Button borders are required** - All buttons must have visible 1px border
10. **Action column order matters** - Left to right: Edit/View → Copy → Delete

## Performance Optimizations

**Code Splitting:**
- Lazy-load large components (e.g., `JobDrawer` in `/producao`)
- Use `React.lazy()` and `Suspense` for drawer components

**Memoization:**
- Memoize expensive computed values with `useMemo`
- Wrap callback functions with `useCallback` (especially in data fetching)
- Memoize large components with `React.memo()` to prevent re-renders

**Bundle Analysis:**
- Run `ANALYZE=true npm run build` to visualize bundle size
- Check for duplicate dependencies and lazy-load opportunities

## Database Migrations

**Creating Migrations:**
```bash
# Create new migration
supabase migration new migration_name

# Push to database
supabase db push
```

**Migration Conventions:**
- Use timestamp prefix: `YYYYMMDD_description.sql`
- Include RLS policies for security
- Add descriptive comments explaining purpose
- Test on local Supabase before deploying

## Environment Variables

**Required (`.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PHC Database (MSSQL)
MSSQL_DIRECT_CONNECTION=...
MSSQL_DIRECT_USERNAME=...
MSSQL_DIRECT_PASSWORD=...

# Supabase Database (for ETL)
PG_HOST=...
PG_DB=postgres
PG_USER=...
PG_PASSWORD=...
PG_PORT=5432
```

**Optional (ETL):**
```env
ETL_SCRIPTS_PATH=scripts/etl
PYTHON_PATH=python
ETL_SYNC_URL=https://your-etl-service.com
ETL_API_KEY=your-api-key

# GitHub Actions (for production ETL)
GH_TOKEN=your-github-token
GH_REPO_OWNER=your-username
GH_REPO_NAME=your-repo
GH_REF=main
```

## Project-Specific Conventions

1. **Portuguese Language:** All UI text, comments, and variable names use Portuguese
2. **FO Numbers:** Folha de Obra (work order) numbers are 6 digits max (`maxLength={6}`)
3. **Standard Heights:** Buttons and inputs use `h-10` (40px)
4. **Icon Sizes:** Button icons `h-4 w-4`, dashboard icons `h-6 w-6`
5. **Spacing:** Sections `space-y-6`, forms `space-y-4`, card padding `p-6`
6. **No Outside Borders:** Tables and data views have only internal row borders
7. **Accessibility Font:** Atkinson Hyperlegible for better readability

## Related Documentation

- Design System: `.cursor/rules/design-system.mdc` (comprehensive styling guide)
- ETL Documentation: `scripts/etl/README.md` (sync workflow details)
- Environment Setup: `.env.example` (required variables)
