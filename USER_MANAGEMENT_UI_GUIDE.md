# User Management - UI/UX Guide

## Visual Layout

### Main Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ GESTÃO DE UTILIZADORES                                  │
│ Crie e gerencie utilizadores, perfis e funções         │
│                                             [NOVO UTILIZADOR]
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ NOME COMPLETO  │ EMAIL  │ FUNÇÃO  │ TELEMÓVEL  │...│  │
│ ├────────────────────────────────────────────────────┤  │
│ │ João Silva     │ j@...  │ Designer│ +351 9...  │ ✏️❌│
│ │ Maria Santos   │ m@...  │ Gestor  │ +351 9...  │ ✏️❌│
│ │ Pedro Costa    │ p@...  │ Admin   │ +351 9...  │ ✏️❌│
│ └────────────────────────────────────────────────────┘  │
│                                           [RECARREGAR]   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Create/Edit User Dialog

```
┌─────────────────────────────────┐
│ CRIAR NOVO UTILIZADOR           │
├─────────────────────────────────┤
│                                 │
│ EMAIL *                         │
│ ┌─────────────────────────────┐ │
│ │ utilizador@example.com      │ │
│ └─────────────────────────────┘ │
│                                 │
│ NOME COMPLETO *                 │
│ ┌─────────────────────────────┐ │
│ │ João Silva                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ PALAVRA-PASSE *                 │
│ ┌─────────────────────────────┐ │
│ │ ••••••••••                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ FUNÇÃO *                        │
│ ┌─────────────────────────────┐ │
│ │ ▼ Selecione uma função      │ │
│ │ ├─ Administrador             │
│ │ ├─ Gestor                    │
│ │ ├─ Designer                  │
│ │ └─ Utilizador                │
│ └─────────────────────────────┘ │
│                                 │
│ TELEMÓVEL                       │
│ ┌─────────────────────────────┐ │
│ │ +351 912 345 678            │ │
│ └─────────────────────────────┘ │
│                                 │
│ NOTAS                           │
│ ┌─────────────────────────────┐ │
│ │ Designer do departamento... │ │
│ │ ...de marketing              │ │
│ └─────────────────────────────┘ │
│                                 │
│     [GUARDAR]    [CANCELAR]     │
└─────────────────────────────────┘
```

## Color & Styling

### Light Mode
```
Background: oklch(0.94 0.01 95.04)    // Light beige
Foreground: oklch(0% 0 0)              // Black
Border: oklch(0% 0 0)                  // Black
Primary: oklch(84.08% 0.1725 84.2)     // Yellow
Accent (hover): oklch(0.8947 0.0111 95.18) // Light beige
```

### Dark Mode
```
Background: oklch(0.31 0 0)            // Dark gray
Foreground: oklch(0.85 0 0)            // Light gray
Border: oklch(0.50 0 0)                // Medium gray
Primary: oklch(84.08% 0.1725 84.2)     // Yellow (same)
Accent (hover): oklch(0.40 0 0)        // Dark gray
```

## Form Validation

### Visual Feedback

#### Success State
```
✅ GUARDAR
```

#### Error State
```
⚠️ Email já está em uso
✅ GUARDAR (disabled)
```

#### Loading State
```
⏳ PROCESSANDO...
✅ GUARDAR (disabled, spinner)
```

## Table Behavior

### Row States

#### Normal Row
```
│ João Silva │ j@email.com │ Designer │ +351 9... │ ✏️ ❌ │
```

#### Hover Row (Light Mode)
```
│ João Silva │ j@email.com │ Designer │ +351 9... │ ✏️ ❌ │ ← Light beige bg
```

#### Hover Row (Dark Mode)
```
│ João Silva │ j@email.com │ Designer │ +351 9... │ ✏️ ❌ │ ← Dark gray bg
```

## User Flows

### Create User Flow

```
1. Click "NOVO UTILIZADOR"
   ↓
2. Dialog opens with form
   ↓
3. Fill in required fields
   - Email ✓
   - Nome Completo ✓
   - Palavra-passe ✓
   - Função ✓
   ↓
4. Optional fields
   - Telemóvel
   - Notas
   ↓
5. Click "GUARDAR"
   ↓
6. Form validates
   - Email check ✓
   - Password length ✓
   - Required fields ✓
   ↓
7. Supabase Auth creates user
   ↓
8. Profile created in database
   ↓
9. Dialog closes
   ↓
10. Table refreshes with new user
```

### Edit User Flow

```
1. Click Edit (✏️) button
   ↓
2. Dialog opens with form
   - Email field is disabled
   - Other fields populated
   ↓
3. Update fields (except email)
   ↓
4. Click "GUARDAR"
   ↓
5. Profile updated in database
   ↓
6. Table refreshes with changes
```

### Delete User Flow

```
1. Click Delete (❌) button
   ↓
2. Confirmation dialog appears
   "Tem certeza que deseja eliminar..."
   ↓
3a. Click "CANCELAR"
    → Dialog closes, no action
    
3b. Click "ELIMINAR"
    → User removed from Auth
    → Profile deleted from database
    → Table refreshes
    → User gone
```

## Dialog Components

### Delete Confirmation Dialog

```
┌──────────────────────────────────────┐
│ CONFIRMAR ELIMINAÇÃO                 │
├──────────────────────────────────────┤
│                                      │
│ Tem certeza que deseja eliminar      │
│ o utilizador João Silva?             │
│                                      │
│       [CANCELAR]    [ELIMINAR]       │
│                    (red button)       │
│                                      │
└──────────────────────────────────────┘
```

### Error Dialog

```
┌──────────────────────────────────────┐
│ ERRO                                 │
├──────────────────────────────────────┤
│                                      │
│ Email já está em uso                 │
│ Verifique e tente outro              │
│                                      │
│                    [FECHAR]          │
│                                      │
└──────────────────────────────────────┘
```

## Responsive Breakpoints

### Mobile (< 640px)

```
GESTÃO DE UTILIZADORES
[NOVO UTILIZADOR]

Table scrolls horizontally
┌──────────────┐
│ NOME COMPLETO│ → swipe
│ João Silva   │
│ Maria Santos │
└──────────────┘

[RECARREGAR]
```

### Tablet (640px - 1024px)

```
┌─────────────────────────────────┐
│ GESTÃO DE UTILIZADORES          │
│              [NOVO UTILIZADOR]  │
├─────────────────────────────────┤
│ Table with basic columns       │
│ ✏️ ❌ buttons                    │
│                                │
│            [RECARREGAR]        │
└─────────────────────────────────┘
```

### Desktop (> 1024px)

```
┌─────────────────────────────────────────────────────┐
│ GESTÃO DE UTILIZADORES                             │
│ Crie e gerencie utilizadores...  [NOVO UTILIZADOR] │
├─────────────────────────────────────────────────────┤
│ All columns visible                                 │
│ Full table with all features                        │
│                                    [RECARREGAR]     │
└─────────────────────────────────────────────────────┘
```

## Icon Legend

| Icon | Name | Action |
|------|------|--------|
| ✏️ | Edit | Edit user |
| ❌ | Delete | Delete user |
| 🔄 | Refresh | Reload table |
| ⚙️ | Settings | Open settings menu |
| 👥 | Users | User management |
| ➕ | Plus | Create new |

## Animation & Transitions

### Dialog Open
- Fade in: 200ms
- Slide up: 200ms
- Easing: ease-out

### Table Hover
- Background transition: 150ms
- Color transition: 150ms
- Easing: ease-in-out

### Button Press
- Scale: 0.98
- Duration: 100ms
- Easing: ease-out

### Loading Spinner
- Rotation: continuous
- Speed: 1000ms
- Direction: clockwise

## Accessibility Features

### Keyboard Navigation
```
Tab      → Move between fields
Shift+Tab → Move backwards
Enter    → Submit form
Escape   → Close dialog/cancel
```

### Screen Reader
```
Buttons labeled with aria-labels
Form fields have labels
Error messages announced
Dialog role defined
```

### Color Contrast
```
Light mode: 21:1 (Black on Light Beige)
Dark mode:  9:1 (Light Gray on Dark Gray)
All exceed WCAG AA standards
```

### Focus States
```
✓ Visible focus ring (black outline)
✓ Tab order logical
✓ No invisible elements
✓ Keyboard accessible
```

## Loading States

### Table Loading
```
┌────────────────────────────┐
│ Carregando utilizadores... │
└────────────────────────────┘
```

### Form Loading
```
⏳ PROCESSANDO...
(Button disabled, spinner visible)
```

### Data Loading
```
[Loading indicator]
Recarregando dados...
```

## Empty States

### No Users

```
┌───────────────────────────────┐
│ Nenhum utilizador registado   │
│     [RECARREGAR]              │
└───────────────────────────────┘
```

### No Search Results

```
┌───────────────────────────────┐
│ Nenhum utilizador encontrado  │
│ para "termo de busca"         │
│     [LIMPAR BUSCA]            │
└───────────────────────────────┘
```

## Error Messages

### Validation Errors

| Field | Error | Message |
|-------|-------|---------|
| Email | Required | "Preencha o campo email" |
| Email | Invalid | "Email inválido" |
| Email | Duplicate | "Email já existe" |
| Name | Required | "Preencha o nome completo" |
| Password | Too short | "Mínimo 6 caracteres" |
| Role | Required | "Selecione uma função" |

### Server Errors

```
"Erro ao carregar utilizadores"
"Erro ao criar utilizador"
"Erro ao atualizar utilizador"
"Erro ao eliminar utilizador"
```

## Success Messages

### Post-Action Feedback

```
✓ Utilizador criado com sucesso
✓ Utilizador atualizado com sucesso
✓ Utilizador eliminado com sucesso
✓ Dados recarregados com sucesso
```

## Menu Integration

### Navigation Sidebar

```
┌──────────────┐
│ ▲            │ ← Toggle
├──────────────┤
│ Painel       │
│ Fluxo        │
│ Produção     │
│ Stocks       │
│ Gestão       │
│ ► Definições │ ← NEW
│   └ Utilizadores ← NEW
└──────────────┘
```

### Expanded Menu

```
┌────────────────────┐
│ ▼                  │
├────────────────────┤
│ Painel de Controlo │
│ Fluxo de Design    │
│ Produção           │
│   - Gestão         │
│   - Operações      │
│ Stocks             │
│ Gestão             │
│   - Faturação      │
│   - Análises       │
│ Definições         │ ← NEW (highlighted)
│   - Utilizadores   │ ← NEW (current)
└────────────────────┘
```

## Typography Hierarchy

```
┌─────────────────────────────────┐
│ GESTÃO DE UTILIZADORES          │ ← Heading (H1)
│ Crie e gerencie utilizadores... │ ← Subheading (Muted)
├─────────────────────────────────┤
│ NOME COMPLETO │ EMAIL │ FUNÇÃO  │ ← Table Header
│ João Silva    │ j@... │ Designer│ ← Body text
│ Maria Santos  │ m@... │ Gestor  │
└─────────────────────────────────┘

Button: [NOVO UTILIZADOR]           ← Button label
Dialog: CRIAR NOVO UTILIZADOR       ← Dialog title
Label:  EMAIL *                     ← Form label
Input:  utilizador@example.com      ← Placeholder text
Error:  ⚠️ Email já existe          ← Error message (small)
```

## Spacing & Layout

### Form Spacing
```
Field Group: 16px (space-y-4)
- Label: 8px margin bottom
- Input: full width
- Helper text: 4px margin top

Form Sections: 16px gap (space-y-4)
Form to Button: 16px gap (pt-4)
```

### Table Spacing
```
Cell Padding: 12px (px-3 py-2)
Row Height: 40px+
Column Gap: 0 (adjacent)
Border Gap: 0
```

### Dialog Spacing
```
Content Padding: 24px (p-6)
Field Spacing: 16px (space-y-4)
Button Group: 12px gap
Dialog to Screen: 16px min
```

## Z-Index Layers

```
Level 1000: Dialogs
Level 100:  Dropdowns
Level 50:   Tooltips
Level 10:   Hover states
Level 1:    Base content
Level 0:    Background
```

This UI guide ensures consistent design and user experience across the user management system.
