# Components Structure

This project uses a clean, organized component structure to maintain code quality and developer experience.

## 📁 Directory Structure

```
components/
├── ui/              # shadcn/ui components (installed via CLI)
│   ├── button.tsx
│   ├── input.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── drawer.tsx
│   ├── calendar.tsx
│   ├── checkbox.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   ├── popover.tsx
│   ├── progress.tsx
│   ├── radio-group.tsx
│   ├── switch.tsx
│   ├── command.tsx
│   ├── label.tsx
│   └── textarea.tsx
│
├── custom/          # Custom reusable components
│   ├── CreatableCombobox.tsx      # Base creatable combobox
│   ├── DatePicker.tsx              # Custom date picker
│   ├── NotasPopover.tsx            # Notes popover
│   ├── SimpleNotasPopover.tsx     # Simplified notes popover
│   └── LogisticaTableWithCreatable.tsx  # Logistics table component
│
└── forms/           # Form-specific components
    ├── CreatableClienteCombobox.tsx
    ├── CreatableArmazemCombobox.tsx
    └── CreatableTransportadoraCombobox.tsx
```

## 📋 Component Categories

### `ui/` - shadcn/ui Components
- **Source**: Installed via `pnpm dlx shadcn@latest add [component]`
- **Purpose**: Core UI primitives from shadcn/ui
- **Do NOT**: Manually edit or copy these files
- **Update**: Use the shadcn CLI to add or update components

### `custom/` - Custom Reusable Components
- **Source**: Custom-built for this project
- **Purpose**: Complex, reusable components that extend shadcn/ui functionality
- **Examples**: Date pickers, custom tables, specialized popovers
- **Import**: `@/components/custom/[ComponentName]`

### `forms/` - Form-Specific Components
- **Source**: Custom-built for this project
- **Purpose**: Form inputs with database integration (Supabase)
- **Examples**: Creatable comboboxes for clients, warehouses, transporters
- **Import**: `@/components/forms/[ComponentName]`

## 🎯 Import Guidelines

```typescript
// ✅ shadcn/ui components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table'

// ✅ Custom components
import DatePicker from '@/components/custom/DatePicker'
import { CreatableCombobox } from '@/components/custom/CreatableCombobox'
import LogisticaTableWithCreatable from '@/components/custom/LogisticaTableWithCreatable'

// ✅ Form components
import CreatableClienteCombobox from '@/components/forms/CreatableClienteCombobox'
import CreatableArmazemCombobox from '@/components/forms/CreatableArmazemCombobox'

// ❌ DO NOT import from root components directory
import SomeComponent from '@/components/SomeComponent' // WRONG!
```

## 🔧 Adding New Components

### Adding a shadcn/ui Component
```bash
cd imacx-clean
pnpm dlx shadcn@latest add [component-name]
```

### Creating a Custom Component
1. Determine if it's a **custom** component or a **form** component
2. Create the file in the appropriate directory:
   - `components/custom/` for general-purpose custom components
   - `components/forms/` for form-specific components with database integration
3. Use proper imports from `@/components/ui/`, `@/lib/utils`, etc.

## 🧹 Maintenance

- **DO**: Keep components in their designated directories
- **DO**: Use shadcn CLI for all ui/ components
- **DO**: Follow the import guidelines above
- **DON'T**: Mix component sources (e.g., don't copy shadcn components manually)
- **DON'T**: Put components directly in the root `components/` directory

