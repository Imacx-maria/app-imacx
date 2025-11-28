# DESIGN SYSTEM (NEW)

Complete, clean, consistent specification for LIGHT and DARK mode.

---

# 1. FOUNDATIONS

## 1.1 Typography

* Font: **Atkinson Hyperlegible** (400 only, no bold except explicitly whitelisted components)
* Global: **uppercase** everywhere unless manually opted out
* Exceptions: login page, form fields requiring normal casing

## 1.2 Radii

* No rounded corners anywhere
* `--radius: 0px` always

## 1.3 Spacing

* Based on Tailwind default spacing scale
* Components should never hardcode padding — use utility classes or shadcn specs

## 1.4 Shadows

* Disabled entirely
* No box shadows, no focus rings unless explicitly added via shadcn

## 1.5 Color Model

* All colors defined using **OKLCH** variables
* No hex, rgb, hsl allowed
* No hardcoded colors allowed anywhere in TSX or CSS

---

# 2. COLOR SYSTEM

## 2.1 Light Mode Variables

```
--background: oklch(0.94 0.01 95.04);
--foreground: oklch(0 0 0);
--border: oklch(0 0 0);
--primary: oklch(84.08% 0.1725 84.2);
--primary-foreground: oklch(0 0 0);
--accent: oklch(0.8947 0.0111 95.18);
--accent-foreground: oklch(0 0 0);
--input: oklch(0.87 0.03 83.3 / 0.3);
```

## 2.2 Dark Mode Variables

```
--background: oklch(0.24 0 0);
--foreground: oklch(0.85 0 0);
--border: oklch(0.50 0 0);
--primary: oklch(84.08% 0.1725 84.2);
--primary-foreground: oklch(0 0 0);
--accent: oklch(0.4 0 0);
--accent-foreground: oklch(0.85 0 0);
--input: oklch(0.34 0 0);
```

## 2.3 Rules for High-Contrast Colors

### Yellow / Orange / Red backgrounds → **dark text only**

No exceptions.

### Dark mode accents → **light text**

---

# 3. BORDERS

## 3.1 Border Variables

```
--border-width: 1px;
--border-style: solid;
```

## 3.2 Border Application Rules

### Borders ONLY appear on:

* Inputs
* Buttons (except ghost or link variants)
* Outline buttons
* Cards
* Table wrappers + table dividers
* Navigation separators
* Layout frames/panels

### Borders must **NOT** appear on:

* All elements by default (no `* { border: ... }`)
* Icons
* Charts
* Typography
* Containers that visually require spacing only

## 3.3 Implementation Pattern

```
.border-default {
  border-width: var(--border-width);
  border-color: var(--border);
  border-style: var(--border-style);
}
```

---

# 4. COMPONENT RULES

## 4.1 Buttons

### Shared rules

* No shadows
* No custom borders
* Must use `border-default` when variant=outline

### Variant: Solid (primary / destructive / secondary)

* Always use background + foreground variables
* Icons inside must inherit text color

### Variant: Ghost / Link

* No borders
* No background
* Only color changes

## 4.2 Cards

* Must use `--card` background
* Must use `border-default`
* No inner borders unless meaningful

## 4.3 Sidebar Navigation

* Sidebar panel has exactly **one** right border
* Active item background must not force white text unless background is dark
* Hover must NOT override yellow background text logic

## 4.4 Inputs & Combobox

* Subtle border only
* No focus outlines
* No inner shadows
* Hover = slightly lighter/darker background using CSS variables

## 4.5 Tables

* Single border under header
* Single border between rows
* Remove double borders from wrappers
* Dark mode uses slightly lighter border: `oklch(0.4 0 0)`

## 4.6 Charts

### Chart Structure Rules

* No borders on chart containers
* No outlines
* Background must be transparent (no white/gray boxes in dark mode)
* All chart colors must be defined globally in chart components

### Chart Color Palettes

**Colorful Palette (Default)**

Used for multi-series charts where distinct colors are needed:

```
#ffa600  // Bright orange
#ff7c43  // Orange
#f95d6a  // Coral
#d45087  // Pink
#a05195  // Magenta
#665191  // Purple
#2f4b7c  // Blue
#003f5c  // Dark blue
```

**Monochromatic Palette**

Used for single-metric charts or when subtle gradation is needed:

```
#ff9b19  // Orange 1
#ffa844  // Orange 2
#ffb564  // Orange 3
#ffc283  // Orange 4
#ffcfa1  // Orange 5
#fedcbf  // Orange 6
```

### Chart Implementation Rules

* Colors defined in `components/charts/imacx-bar-chart.tsx` as `CHART_COLORS_COLORFUL` and `CHART_COLORS_MONO`
* Default palette: `CHART_COLORS = CHART_COLORS_COLORFUL`
* Line charts import colors from bar chart component for consistency
* Colors cycle through array when more data series than colors exist
* Chart text uses `var(--foreground)` for proper light/dark mode support
* Grid lines use `var(--border)` for consistency
* Tooltips use `var(--background)` and `var(--foreground)`

---

# 5. HOVER & STATE RULES

## 5.1 Hover Color System

* Hover must NEVER override the background→foreground relationship
* No global hover selectors that force foreground color

## 5.2 Active States

* Only change background or border intensity
* Must not change font-weight

## 5.3 Focus States

* No default browser outlines
* Use a 1px border color shift if needed

---

# 6. LAYOUT RULES

## 6.1 Panels / Page Wrappers

* Each major panel can have a `border-default` if needed
* Never stack multiple borders between panels

## 6.2 Sidebar Divider

* Exactly one 1px border-right
* No double borders from wrappers

## 6.3 Header & Footer

* Must not use hardcoded colors
* Must rely strictly on variables

---

# 7. FILE STRUCTURE RULES

## 7.1 Allowed Styling

* Tailwind classes
* CSS variables
* Component-level class names
* Shadcn-appropriate variants

## 7.2 Forbidden Styling

* Inline styles with colors
* Inline borders (tailwind `border` without variables)
* Arbitrary color classes (`text-[#123456]`, etc.)
* Hardcoded hover colors
* Hardcoded outlines

---

# 8. CONSISTENCY CHECKLIST

### Before shipping a component, verify:

* [ ] No hardcoded colors exist
* [ ] Color changes between light/dark modes use variables only
* [ ] No unexpected borders appear
* [ ] Yellow/orange/red backgrounds show dark text
* [ ] Tables have no double borders
* [ ] Sidebar shows only one border
* [ ] Buttons follow the variant rules
* [ ] Inputs have subtle border + no shadow
* [ ] No element accidentally inherits text-transform / font-weight exceptions

---

# 9. EXTENSIBILITY RULES

## 9.1 Adding new colors

* Must be defined in `:root` and `.dark`
* Must include background and foreground variants

## 9.2 Adding new components

* Must use the border / color / hover patterns defined here

---

# 10. DESIGN PHILOSOPHY

* Clean
* Minimalist
* Brutalist shaping (no radii)
* High readability
* Consistency above all
* Zero visual noise (no shadows)
* Strict variable-based skinning

---

# END OF DESIGN SYSTEM
