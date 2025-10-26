# Priority Color Synchronization Solution

## Problem
The priority (P) color indicator needs to be **consistent** across all 3 pages:
1. Main Produção Page (`app/producao/page.tsx`)
2. Operations Page (`app/producao/operacoes/page.tsx`)
3. Designer Flow Page (`app/designer-flow/page.tsx`)

**Challenge:** Each page was using different date fields from different tables, causing inconsistencies.

## Solution: Add `data_in` Field

### Database Changes

**Migration File:** `supabase/migrations/20251026_add_data_in_to_folhas_obras.sql`

1. Add `data_in` column to `folhas_obras` table
2. Add `data_in` column to `items_base` table
3. Backfill existing records with `created_at` values
4. Create indexes for performance

### Why This Approach?

1. **Single Source of Truth:** All pages use the same field (`data_in`) from the same source
2. **Clean Data Model:** `data_in` represents when the work order was first entered
3. **No Query Errors:** Field exists in all necessary tables
4. **Consistent Logic:** Same calculation across all pages

## Priority Color Rules (Consistent Across All Pages)

```typescript
if (prioridade === true) → 🔴 Red (bg-destructive)
else if (days since data_in > 3) → 🔵 Blue (bg-info)
else → 🟢 Green (bg-success)
```

## Implementation Steps

### 1. Run Migration
```bash
# Apply the migration to your Supabase database
supabase db push
```

### 2. Update Main Produção Page
- ✅ Already uses `data_in` correctly
- No changes needed

### 3. Update Operations Page
```typescript
// Query: Add data_in to items_base selection
items_base!inner (
  id,
  descricao,
  codigo,
  quantidade,
  concluido,
  concluido_maq,
  brindes,
  prioridade,
  complexidade,
  created_at,
  data_in, // ← ADD THIS
  folhas_obras (...)
)

// Logic: Use data_in directly from items_base
const getPColor = (item: ProductionItem): string => {
  if (item.prioridade) return 'bg-destructive'
  if (item.data_in) {
    const days = (Date.now() - new Date(item.data_in).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return 'bg-info'
  }
  return 'bg-success'
}
```

### 4. Update Designer Flow Page
```typescript
// Query: Add data_in to folhas_obras_with_dias selection
const columns = 'id, created_at, numero_fo, numero_orc, nome_campanha, data_saida, prioridade, data_in'

// Logic: Use data_in from job
const getPriorityColor = (job: Job): PriorityColor => {
  if (job.prioridade === true) return 'red'
  if (job.data_in) {
    const days = (Date.now() - new Date(job.data_in).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return 'blue'
  }
  return 'green'
}
```

## Benefits

✅ **Consistent:** All pages use the same field and same logic
✅ **No Errors:** Field exists in database after migration
✅ **Maintainable:** Single place to understand priority logic
✅ **Scalable:** Easy to adjust the 3-day threshold if needed
✅ **Controlled:** Priority can only be set on main Produção page
✅ **Synced:** Changes to priority instantly reflect on all pages

## Testing Checklist

- [ ] Run the migration on your database
- [ ] Verify `data_in` field exists in `folhas_obras` table
- [ ] Verify `data_in` field exists in `items_base` table
- [ ] Test main Produção page - verify P colors work
- [ ] Test Operations page - verify P colors match main page
- [ ] Test Designer Flow page - verify P colors match main page
- [ ] Create a new work order - verify `data_in` is set automatically
- [ ] Set priority on main page - verify red appears on all pages
- [ ] Wait 4 days - verify blue appears on all pages

## Maintenance

If you need to adjust the priority aging threshold (currently 3 days):

1. Update all 3 `getPColor` / `getPriorityColor` functions
2. Change `days > 3` to your desired threshold
3. Keep the logic identical across all pages

