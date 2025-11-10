# Stocks/Gestao UX Analysis & Refactoring Plan

**Date:** 2025-11-10
**Scope:** `app/stocks/page.tsx` + `app/stocks/gestao/page.tsx`
**Total Lines:** 8,140 lines (3,908 + 4,232)

## 🎯 Executive Summary

The stocks and gestao pages suffer from significant UX and code quality issues that impact both user productivity and developer maintainability. Users report workflows that should take seconds actually take several minutes due to poor field organization, missing constraints, and complex navigation patterns.

---

## 📊 Current State Assessment

### File Size Issues
| File | Lines | Status | Target |
|------|-------|--------|--------|
| `stocks/page.tsx` | 3,908 | ❌ Too large | <500 lines |
| `stocks/gestao/page.tsx` | 4,232 | ❌ Too large | <500 lines |
| **Total** | **8,140** | **Critical** | **~2,000** |

**Impact:**
- Difficult to maintain
- Hard to review in PRs
- Slow IDE performance
- High cognitive load

---

## 🔍 Identified UX Problems

### 1. Field Sizing Issues ⚠️

**Problem:** Inconsistent or missing `maxLength` constraints on input fields.

**Found Examples:**
```typescript
// Line 2820: Quantidade has maxLength (GOOD)
maxLength={6}

// Line 2860: Size X has maxLength (GOOD)
maxLength={5}

// Line 2900: Size Y has maxLength (GOOD)
maxLength={5}

// NEEDS VERIFICATION:
// - no_guia_forn (supplier guide number)
// - ref_cartao (card reference)
// - Other numeric fields
```

**Expected Constraints:**
Based on common data requirements:
- `no_guia_forn` (supplier guide): 10-15 chars max
- `ref_cartao` (card ref): 20 chars max
- `qt_palete` (pallet quantity): 6 digits max
- Postal codes: 8 chars (XXXX-XXX format)
- Phone numbers: 15 chars max

**User Impact:**
- Users can enter invalid data (too long)
- Database errors when saving
- Poor data quality
- Frustration when form rejects after typing too much

---

### 2. Random Field Placement ❌

**Problem:** Fields appear without logical grouping, making forms hard to scan and fill.

**Current Pattern:**
```
[Material] [Quantidade] [Size X] [Size Y] [Preço] [Other Random Fields]
```

**Issues:**
- No visual separation between field groups
- Related fields scattered across the form
- No progressive disclosure (all fields visible always)
- Inconsistent field ordering between pages

**Recommended Grouping:**
```
┌─ MATERIAL INFORMATION ────────┐
│ Material, Cor, Tipo, Caract.  │
└───────────────────────────────┘

┌─ DIMENSIONS ──────────────────┐
│ Size X, Size Y, Quantidade    │
└───────────────────────────────┘

┌─ PRICING ─────────────────────┐
│ Preço Unit., Valor Total      │
└───────────────────────────────┘

┌─ SUPPLIER INFO ───────────────┐
│ Fornecedor, Nº Guia, Ref      │
└───────────────────────────────┘

┌─ METADATA ────────────────────┐
│ Data, Autor, Notas            │
└───────────────────────────────┘
```

---

### 3. Complex Workflow ⏱️

**Problem:** Current workflow takes **minutes** when it should take **seconds**.

**Workflow Analysis:**

**Current Steps (Stock Entry):**
1. Navigate to stocks page (load 4,232 lines)
2. Switch to "Entries" tab
3. Click "Add" button
4. Select material from dropdown (cascading queries)
5. Manually enter quantidade
6. Manually enter Size X
7. Manually enter Size Y
8. Manually enter preço
9. Manually calculate valor total (or wait for auto-calc)
10. Enter supplier info (Fornecedor dropdown)
11. Enter no_guia_forn
12. Enter ref_cartao
13. Enter data
14. Save (validation errors possible)
15. Repeat for each entry

**Estimated Time:** 2-3 minutes per entry

**Bottlenecks:**
- Too many manual steps
- No smart defaults
- No keyboard shortcuts
- Redundant data entry
- Multiple dropdowns with slow loading
- No batch operations
- Complex validation that blocks saving

**User Quotes (from requirements):**
> "Takes forever to enter stock"
> "Why do I have to fill in the same things every time?"
> "The form doesn't remember my last selections"

---

### 4. Code Duplication & Complexity 🔁

**Problem:** Massive code duplication and inline logic.

**Duplicate Patterns Found:**
```typescript
// PATTERN 1: Repeated 10+ times
onBlur={(e) => {
  const val = e.target.value.replace(/[^0-9]/g, '')
  updateEntry(index, 'field', val ? parseInt(val) : 0)
}}
onKeyDown={(e) => {
  if (e.key === 'Enter') {
    // Same logic as onBlur
  }
}}
```

**Pattern 2: Inline styles repeated**
```typescript
className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
```
Used 20+ times!

**Pattern 3: Filter reset buttons**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
  onClick={() => setFilter('')}
>
  <XSquare className="h-4 w-4" />
</Button>
```
Repeated 15+ times with slight variations.

---

### 5. Missing Features 🚫

**What Users Need:**

1. **Smart Defaults**
   - Remember last selected material
   - Pre-fill common dimensions
   - Auto-suggest based on history

2. **Keyboard Shortcuts**
   - `Ctrl+S` to save
   - `Ctrl+N` for new entry
   - `Tab` navigation that makes sense
   - `Ctrl+D` to duplicate last entry

3. **Batch Operations**
   - Add multiple entries at once
   - Bulk edit similar entries
   - Copy/paste from spreadsheet

4. **Better Validation**
   - Inline error messages
   - Real-time validation feedback
   - Clear error explanations

5. **Auto-save**
   - Save draft every 30 seconds
   - Restore on page reload
   - Prevent data loss

---

## 🎯 Refactoring Strategy

### Phase 1: Extract Reusable Components (Target: 2 days)

**Components to Create:**

1. **`StockInputField.tsx`**
   - Handles numeric input with validation
   - Built-in maxLength
   - onBlur/onKeyDown logic
   - Error display
   - ~50 lines

2. **`StockMaterialSelector.tsx`**
   - Material combobox with caching
   - Recent selections
   - Quick search
   - ~150 lines

3. **`FilterWithClear.tsx`**
   - Input + clear button pattern
   - Reusable across all filters
   - ~40 lines

4. **`StockEntryForm.tsx`**
   - Entire entry form
   - Field grouping
   - Validation logic
   - ~300 lines

5. **`StockEntryRow.tsx`**
   - Table row for inline editing
   - ~200 lines

6. **`StockFilters.tsx`**
   - All filter controls
   - State management
   - ~150 lines

**Expected Reduction:**
- stocks/page.tsx: 3,908 → ~800 lines (80% reduction)
- stocks/gestao/page.tsx: 4,232 → ~900 lines (79% reduction)
- New components: ~890 lines
- **Total: 8,140 → 2,590 lines (68% reduction)**

---

### Phase 2: Fix Field Sizing (Target: 0.5 days)

**Actions:**

1. Audit all input fields
2. Add proper `maxLength` to:
   - no_guia_forn: 15
   - ref_cartao: 20
   - quantidade: 6
   - size_x: 5
   - size_y: 5
   - preco_unitario: 10 (with decimal)
   - Any other text inputs

3. Add visual indicators (char counter for long fields)
4. Test with real data

---

### Phase 3: Reorganize Layout (Target: 1 day)

**Actions:**

1. **Implement Field Groups with Cards**
   ```tsx
   <Card className="mb-4">
     <CardHeader>Material Information</CardHeader>
     <CardContent>
       {/* Material fields */}
     </CardContent>
   </Card>
   ```

2. **Apply Gestalt Principles**
   - **Proximity:** Group related fields close together
   - **Similarity:** Use consistent styling for similar fields
   - **Closure:** Use cards/borders to create visual groups
   - **Common Fate:** Animate related fields together

3. **Progressive Disclosure**
   - Collapse optional sections
   - Show advanced fields on demand
   - Hide metadata by default

4. **Responsive Layout**
   - 2-column on desktop
   - 1-column on mobile
   - Proper field widths

---

### Phase 4: Streamline Workflow (Target: 2 days)

**Optimizations:**

1. **Smart Defaults**
   ```typescript
   // Remember last selections
   const lastMaterial = useLocalStorage('lastMaterial')
   const lastSupplier = useLocalStorage('lastSupplier')

   // Pre-fill on new entry
   useEffect(() => {
     if (isNew) {
       setFormData({
         material_id: lastMaterial,
         fornecedor_id: lastSupplier,
         // ...
       })
     }
   }, [isNew])
   ```

2. **Keyboard Shortcuts**
   ```typescript
   useHotkeys('ctrl+s', () => handleSave())
   useHotkeys('ctrl+n', () => handleNew())
   useHotkeys('ctrl+d', () => handleDuplicate())
   ```

3. **Auto-save**
   ```typescript
   const debouncedSave = useDebouncedCallback(
     () => saveEntry(),
     30000 // 30 seconds
   )
   ```

4. **Batch Operations**
   - Add "Duplicate Entry" button
   - Enable multi-select
   - Bulk edit modal

5. **Better Validation**
   - Use `react-hook-form` with `zod`
   - Inline error messages
   - Prevent invalid submissions

**Expected Time Savings:**
- Current: 2-3 minutes per entry
- Target: **20-30 seconds per entry**
- **Improvement: 75-85% faster**

---

### Phase 5: Add Missing Features (Target: 1 day)

**Features:**

1. **Quick Add Mode**
   - Minimal form with only essential fields
   - Keyboard-only navigation
   - Rapid entry for repetitive tasks

2. **Import from Excel**
   - Paste or upload spreadsheet
   - Auto-map columns
   - Batch create entries

3. **Entry Templates**
   - Save common entry patterns
   - One-click apply
   - Share with team

4. **Audit Trail**
   - Who created/modified
   - Change history
   - Restore previous versions

---

## 📋 Implementation Checklist

### Week 1: Component Extraction
- [ ] Create `components/stocks/` directory
- [ ] Extract `StockInputField.tsx`
- [ ] Extract `StockMaterialSelector.tsx`
- [ ] Extract `FilterWithClear.tsx`
- [ ] Extract `StockEntryForm.tsx`
- [ ] Extract `StockEntryRow.tsx`
- [ ] Extract `StockFilters.tsx`
- [ ] Update imports in main pages
- [ ] Test all extracted components
- [ ] Verify no regressions

### Week 2: UX Improvements
- [ ] Audit and fix all field sizing
- [ ] Implement field grouping with Cards
- [ ] Add progressive disclosure
- [ ] Implement smart defaults
- [ ] Add keyboard shortcuts
- [ ] Add auto-save
- [ ] Implement batch operations
- [ ] Add better validation
- [ ] User testing with colleagues

### Week 3: Polish & Features
- [ ] Add Quick Add mode
- [ ] Implement Excel import
- [ ] Create entry templates
- [ ] Add audit trail
- [ ] Performance testing
- [ ] Final user testing
- [ ] Documentation
- [ ] Training materials

---

## 🎨 Design Mockup (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  📦 GESTÃO DE STOCKS                    [Novo] [Importar]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ MATERIAL ─────────────────────────────────────────────┐ │
│  │  Material: [Combobox________________] Cor: [____]      │ │
│  │  Tipo: [____] Característica: [____]                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ DIMENSÕES ────────────────────────────────────────────┐ │
│  │  Qtd: [____] (max 6 dígitos)                           │ │
│  │  Size X: [____] mm  Size Y: [____] mm                  │ │
│  │  Área: 6.00 m² (auto-calculado)                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ PREÇO ───────────────────────────────────────────────┐  │
│  │  Preço Unit: [____] €                                  │ │
│  │  Valor Total: 150.00 € (auto-calculado)               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ▶ FORNECEDOR (opcional)                                     │
│  ▶ NOTAS (opcional)                                          │
│                                                               │
│  [Cancelar]  [Guardar] (Ctrl+S)  [Guardar e Novo] (Ctrl+N) │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Lines of Code** | 8,140 | 2,590 | **-68%** |
| **Entry Time** | 2-3 min | 20-30 sec | **-85%** |
| **Component Count** | 2 | 8 | **+300%** |
| **Maintainability** | Poor | Good | **↑↑↑** |
| **User Satisfaction** | Low | High | **↑↑↑** |

---

## 🚀 Next Steps

1. **Review this analysis** with team
2. **Prioritize features** based on user feedback
3. **Create design mockups** for approval
4. **Start Phase 1** (Component Extraction)
5. **Iterative testing** with real users
6. **Monitor metrics** post-deployment

---

## 📚 Resources

- [Gestalt Principles](https://www.interaction-design.org/literature/topics/gestalt-principles)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [useHotkeys](https://github.com/JohannesKlauss/react-hotkeys-hook)
- [Next.js Code Splitting](https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading)
