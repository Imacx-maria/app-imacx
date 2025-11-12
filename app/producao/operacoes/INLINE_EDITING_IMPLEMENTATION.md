# Inline Editing Implementation Guide

## Overview
This document outlines the changes needed to implement inline editing for all production operation tables in `app/producao/operacoes/page.tsx`.

## Key Changes Summary

### 1. Remove Edit Mode Toggle
**BEFORE:** Users must click Edit button, make changes, then click Save/Cancel
**AFTER:** All fields are always editable, changes auto-save on blur/change

### 2. Simplify Row Duplication
**BEFORE:** Complex batch split dialog with multiple fields
**AFTER:** Simple "Duplicate" button that creates new row with smart quantity defaulting

### 3. Add Progress Tracking
**NEW:** Visual progress indicators showing planned vs executed quantities

## Implementation Steps

### Step 1: Add New Imports
Add to the top of `page.tsx`:

```typescript
import {
  duplicateOperationRow,
  autoSaveField,
  validateOperationQuantity,
  calculatePrintJobProgress,
  calculateCutFromPrintProgress,
  calculateCutJobProgress,
} from "./utils/operationsHelpers";
import { OperationProgress, InlineProgress } from "./components/OperationProgress";
import { useDebounce } from "@/hooks/useDebounce"; // Create if doesn't exist
```

### Step 2: Remove Edit Mode State from OperationsTable Function

**REMOVE these lines** (around line 2036-2039):
```typescript
// Edit mode state
const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set());
const [editDrafts, setEditDrafts] = useState<
  Record<string, Record<string, any>>
>({});
```

**REMOVE these functions** (around line 2142-2176):
```typescript
const startEdit = (opId: string) => { ... }
const cancelEdit = (opId: string) => { ... }
```

### Step 3: Replace acceptEdit with Auto-Save Handler

**REPLACE the acceptEdit function** (around line 2178) with:

```typescript
const handleFieldChange = async (
  opId: string,
  field: string,
  value: any
) => {
  const operation = operations.find((op) => op.id === opId);
  if (!operation) return;

  // Validate quantity changes
  if (field === "num_placas_print" || field === "num_placas_corte") {
    const qty = parseFloat(String(value)) || 0;
    const validation = await validateOperationQuantity(supabase, operation, qty);

    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    if (validation.warning) {
      console.log("Warning:", validation.warning);
    }
  }

  // Auto-save the field
  const result = await autoSaveField(
    supabase,
    opId,
    field,
    value,
    logFieldUpdate
  );

  if (result.success) {
    // Refresh operations to show updated data
    onRefresh();

    // Sync to related cut operations if needed
    if (operation.Tipo_Op === "Impressao" && ["material_id", "num_placas_print", "notas_imp", "N_Pal", "data_operacao"].includes(field)) {
      await syncImpressaoToCorte(opId, field, value);
    }
  } else {
    alert(`Erro ao guardar: ${result.error}`);
  }
};

const syncImpressaoToCorte = async (impressaoId: string, field: string, value: any) => {
  const { data: linkedCorteOps } = await supabase
    .from("producao_operacoes")
    .select("id")
    .eq("source_impressao_id", impressaoId);

  if (linkedCorteOps && linkedCorteOps.length > 0) {
    const corteUpdate: Record<string, any> = {};
    if (field === "material_id") corteUpdate.material_id = value;
    if (field === "num_placas_print") corteUpdate.QT_print = value;
    if (field === "notas_imp") corteUpdate.notas = value;
    if (field === "N_Pal") corteUpdate.N_Pal = value;
    if (field === "data_operacao") corteUpdate.data_operacao = value;

    for (const corteOp of linkedCorteOps) {
      await supabase
        .from("producao_operacoes")
        .update(corteUpdate)
        .eq("id", corteOp.id);
    }
  }
};
```

### Step 4: Simplify Row Duplication

**REPLACE the openBatchDialog and handleBatchSplit functions** with:

```typescript
const handleDuplicateRow = async (operation: ProductionOperation) => {
  const result = await duplicateOperationRow(supabase, operation);

  if (result.success) {
    onRefresh();
    onMainRefresh();
  } else {
    alert(`Erro ao duplicar operação: ${result.error}`);
  }
};
```

**REMOVE the batch dialog state** (around line 2042-2047):
```typescript
// Batch split dialog state
const [batchDialogOpen, setBatchDialogOpen] = useState(false);
const [batchSourceOp, setBatchSourceOp] = useState<ProductionOperation | null>(null);
const [batchSplits, setBatchSplits] = useState<...>([...]);
```

**REMOVE the entire batch dialog JSX** (around line 3142-3289):
```typescript
{/* Batch Split Dialog */}
<Dialog open={batchDialogOpen} ...>
  ...
</Dialog>
```

### Step 5: Update Table Row Rendering

In the table body mapping (around line 2800+), make these changes:

**REMOVE the isEditing check**:
```typescript
// BEFORE:
const isEditing = editingRowIds.has(op.id);

// AFTER: Remove this line entirely
```

**UPDATE all input fields to remove disabled prop**:

```typescript
// BEFORE (for Select components):
<Select
  value={...}
  onValueChange={(v) => {
    if (isEditing) {
      changeField(op.id, "operador_id", v);
    }
  }}
  disabled={!isEditing}
>

// AFTER:
<Select
  value={op.operador_id || ""}
  onValueChange={(v) => handleFieldChange(op.id, "operador_id", v)}
>
```

```typescript
// BEFORE (for Input components):
<Input
  type="number"
  value={
    isEditing && editDrafts[op.id]?.num_placas_print !== undefined
      ? String(editDrafts[op.id]?.num_placas_print ?? "")
      : String(op.num_placas_print ?? "")
  }
  onChange={(e) => {
    if (isEditing) {
      changeField(op.id, "num_placas_print", e.target.value);
    }
  }}
  disabled={!isEditing}
/>

// AFTER:
<Input
  type="number"
  step="0.1"
  value={String(op.num_placas_print ?? "")}
  onChange={(e) => {
    const value = e.target.value;
    if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
      handleFieldChange(op.id, "num_placas_print", value);
    }
  }}
  onBlur={() => {
    // Trigger validation and save on blur
    if (op.num_placas_print) {
      handleFieldChange(op.id, "num_placas_print", op.num_placas_print);
    }
  }}
/>
```

**UPDATE the actions column** (around line 3088):

```typescript
// BEFORE:
<TableCell>
  <div className="flex gap-1">
    {!isEditing ? (
      <>
        <Button size="icon" variant="outline" onClick={() => startEdit(op.id)}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => openBatchDialog(op)}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="destructive" onClick={() => handleDeleteOperation(op.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </>
    ) : (
      <>
        <Button size="icon" variant="default" onClick={() => acceptEdit(op.id)}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="destructive" onClick={() => cancelEdit(op.id)}>
          <XSquare className="h-4 w-4" />
        </Button>
      </>
    )}
  </div>
</TableCell>

// AFTER:
<TableCell>
  <div className="flex gap-1">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleDuplicateRow(op)}
            title="Duplicar linha"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Duplicar para dividir operação</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Button
      size="icon"
      variant="destructive"
      onClick={() => handleDeleteOperation(op.id)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
</TableCell>
```

### Step 6: Add Progress Tracking

Add a new section **ABOVE** the operations table to show grouped progress:

```typescript
// Add this before the <Table> component
<div className="mb-4 space-y-2">
  <h3 className="text-sm font-semibold">Progresso Geral</h3>
  {/* Group operations by print_job_id */}
  {Array.from(new Set(operations.filter(op => op.print_job_id).map(op => op.print_job_id))).map(printJobId => {
    const jobOps = operations.filter(op => op.print_job_id === printJobId);
    const sourceOp = jobOps.find(op => op.is_source_record);

    if (!sourceOp) return null;

    const planned = sourceOp.qt_print_planned || 0;
    const executed = jobOps
      .filter(op => !op.is_source_record)
      .reduce((sum, op) => sum + (op.num_placas_print || 0), 0);
    const remaining = Math.max(0, planned - executed);
    const progress = planned > 0 ? Math.round((executed / planned) * 100) : 0;

    return (
      <div key={printJobId} className="border-l-4 border-blue-500 pl-3">
        <div className="text-sm font-medium mb-1">
          {sourceOp.plano_nome || "Sem nome"} - {sourceOp.no_interno}
        </div>
        <OperationProgress
          planned={planned}
          executed={executed}
          remaining={remaining}
          progress={progress}
          operationType="print"
          showDetails={false}
          compact={false}
        />
      </div>
    );
  })}
</div>
```

## Apply Same Changes to Other Tables

### CorteFromPrintTable
Apply all the same changes as OperationsTable:
1. Remove edit mode state
2. Remove edit functions
3. Replace with `handleFieldChange`
4. Update all inputs to use `handleFieldChange` directly
5. Simplify actions column
6. Add progress tracking for cut-from-print jobs

### CorteLoosePlatesTable (if exists in page.tsx)
Apply same pattern:
1. Remove edit mode
2. Inline editing for all fields
3. Simple duplication
4. Progress tracking for cut-only jobs

## Testing Checklist

After implementing all changes:

- [ ] Fields are editable without clicking Edit button
- [ ] Changes auto-save on blur/change
- [ ] Duplicate button creates new row with smart quantity
- [ ] For print: new row starts with remaining quantity
- [ ] For cut-from-print: new row respects both printed and planned limits
- [ ] Progress indicators show correct percentages
- [ ] Validation prevents exceeding planned quantities
- [ ] Sync from Impressão to Corte still works
- [ ] Delete still works
- [ ] Concluído checkbox still works
- [ ] All dropdowns and inputs function correctly

## Additional Notes

- The database trigger `trg_validate_operation_quantities` will provide backend validation
- Frontend validation in `validateOperationQuantity` provides immediate feedback
- Auto-save happens on blur for text inputs and immediately for selects/checkboxes
- Progress tracking updates after each save via `onRefresh()`
