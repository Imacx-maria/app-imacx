---
name: imacx-charts-tables
description: Applies IMACX's official brand colors, typography and design system to charts, tables and data visualizations. Uses OKLCH color system, brutalist design (no rounded corners), and Atkinson Hyperlegible font.
license: IMACX Internal Use
---

# IMACX Charts & Tables Styling

## Overview

This skill applies IMACX's design system to all charts, tables, and data visualizations. It ensures consistency with the company's brutalist design philosophy, OKLCH color system, and accessibility-focused typography.

**Keywords**: charts, tables, data visualization, graphs, analytics, dashboards, IMACX branding, brutalist design, OKLCH colors, Atkinson Hyperlegible

## Design System Foundation

### Core Principles
- **Brutalist Design**: No rounded corners (radius: 0px)
- **High Readability**: Atkinson Hyperlegible font
- **Clean Minimalism**: No shadows or unnecessary decorations
- **Consistency**: Strict variable-based theming
- **Accessibility**: High contrast ratios, clear visual hierarchy

## Brand Guidelines

### Logo
- Location: `/imacx_pos.svg`
- Usage: Header/footer placement, reports cover page
- Never distort or modify the logo proportions

### Colors (OKLCH)

**Light Mode:**
```css
--background: oklch(0.94 0.01 95.04);
--foreground: oklch(0 0 0);
--border: oklch(0 0 0);
--primary: oklch(84.08% 0.1725 84.2);  /* Green accent */
--accent: oklch(0.8947 0.0111 95.18);
--input: oklch(0.87 0.03 83.3 / 0.3);
```

**Dark Mode:**
```css
--background: oklch(0.24 0 0);
--foreground: oklch(0.85 0 0);
--border: oklch(0.50 0 0);
--primary: oklch(84.08% 0.1725 84.2);  /* Green accent */
--accent: oklch(0.4 0 0);
--input: oklch(0.34 0 0);
```

**Chart Color Palette (Sequential):**
1. Primary Green: `oklch(84.08% 0.1725 84.2)`
2. Blue: `oklch(0.6 0.15 240)`
3. Orange: `oklch(0.7 0.18 60)`
4. Purple: `oklch(0.5 0.2 300)`
5. Teal: `oklch(0.65 0.12 180)`
6. Red: `oklch(0.55 0.22 30)`

### Typography

- **All Text**: Atkinson Hyperlegible (400 weight only)
- **Text Transform**: UPPERCASE (except form fields and data values)
- **Headings**: 24pt+ for main titles
- **Body Text**: 14-16pt for readability
- **Table Text**: 14pt minimum
- **Chart Labels**: 12pt minimum

## Chart Specifications

### General Chart Rules
- No rounded corners on bars/columns
- No drop shadows or 3D effects
- Gridlines: 1px solid using border color
- Background: Transparent or card background
- Legend: Top or right placement
- Axis labels: UPPERCASE

### Bar/Column Charts
```python
# Example configuration
chart_config = {
    'bar_width': 0.8,  # Wider bars for brutalist look
    'corner_radius': 0,  # No rounding
    'colors': ['oklch(84.08% 0.1725 84.2)', ...],
    'grid': {
        'stroke': 'var(--border)',
        'strokeWidth': 1,
        'strokeDasharray': None  # Solid lines
    }
}
```

### Line Charts
- Line width: 2-3px for visibility
- Data points: Square markers (no circles)
- No area fills unless showing ranges
- Sharp corners (no curve smoothing)

### Pie/Donut Charts
- Flat design (no gradients)
- Clear separation between segments
- Labels outside with leader lines
- Center hole for donut: 50% radius

### Heatmaps & Matrices
- Square cells only
- 1px borders between cells
- Color intensity using OKLCH lightness channel
- Clear value labels in each cell

## Table Specifications

### Table Structure
```css
.imacx-table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    text-transform: uppercase;
    font-family: 'Atkinson Hyperlegible', sans-serif;
}
```

### Header Styling
- Background: `var(--accent)`
- Text: `var(--accent-foreground)`
- Border-bottom: `1px solid var(--border)`
- Font-weight: 400 (no bold)
- Padding: 12px 16px

### Row Styling
- Alternating rows: Use subtle background variation
- Borders: Single 1px border between rows
- Hover state: Slightly lighter/darker background
- No zebra striping in dark mode

### Cell Styling
- Padding: 10px 16px
- Text alignment: Left for text, right for numbers
- No internal cell borders except for visual separation
- Minimum height: 44px for accessibility

## Implementation Examples

### Recharts Configuration
```javascript
const chartTheme = {
  // Remove all rounded corners
  barCategoryGap: '20%',
  barGap: 4,
  
  // Colors
  colors: [
    'oklch(84.08% 0.1725 84.2)',
    'oklch(0.6 0.15 240)',
    'oklch(0.7 0.18 60)',
    // ... rest of palette
  ],
  
  // Typography
  style: {
    fontFamily: 'Atkinson Hyperlegible',
    textTransform: 'uppercase',
    fontSize: 14
  },
  
  // Grid
  cartesianGrid: {
    strokeDasharray: 'none',
    stroke: 'var(--border)',
    strokeWidth: 1
  }
};
```

### Python/Matplotlib Configuration
```python
import matplotlib.pyplot as plt
import matplotlib as mpl

# IMACX style configuration
mpl.rcParams['font.family'] = 'Atkinson Hyperlegible'
mpl.rcParams['font.size'] = 14
mpl.rcParams['axes.spines.right'] = False
mpl.rcParams['axes.spines.top'] = False
mpl.rcParams['axes.linewidth'] = 1
mpl.rcParams['grid.linewidth'] = 1
mpl.rcParams['xtick.major.width'] = 1
mpl.rcParams['ytick.major.width'] = 1

# Color cycle
imacx_colors = [
    '#c4e36d',  # Primary green (converted from OKLCH)
    '#668fcc',  # Blue
    '#e6a85c',  # Orange
    '#8b6bb1',  # Purple
    '#5eb3a6',  # Teal
    '#d65d5d'   # Red
]
plt.rcParams['axes.prop_cycle'] = plt.cycler(color=imacx_colors)
```

## Export & Production Rules

### Print/PDF Export
- Minimum DPI: 300
- Color space: CMYK for print, RGB for digital
- Include IMACX logo on title page
- Margins: 20mm minimum
- Page orientation: Landscape for wide tables

### Digital Display
- Responsive sizing for mobile/tablet/desktop
- SVG format preferred for charts
- Interactive tooltips with high contrast
- Keyboard navigation support

### PowerPoint/Presentation
- Use company template if available
- 16:9 aspect ratio
- Chart size: Maximum 80% of slide area
- Consistent positioning across slides

## Accessibility Guidelines

### Color Contrast
- Minimum WCAG AA compliance (4.5:1 for normal text)
- Never rely solely on color to convey information
- Use patterns or labels for differentiation

### Interactive Elements
- Minimum touch target: 44x44px
- Clear focus indicators
- Keyboard navigation support
- Screen reader compatible labels

### Data Tables
- Proper table headers (th elements)
- Scope attributes for complex tables
- Caption or summary for context
- Sortable columns clearly indicated

## Common Patterns

### KPI Cards
```css
.kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    padding: 24px;
    text-transform: uppercase;
}
.kpi-value {
    font-size: 32px;
    color: var(--primary);
}
.kpi-label {
    font-size: 14px;
    color: var(--foreground);
    margin-top: 8px;
}
```

### Dashboard Layouts
- Grid-based layout (no float)
- Consistent spacing (16px or 24px gaps)
- Maximum 4 columns on desktop
- Stack on mobile (single column)

### Data Highlighting
- Success: Use primary green
- Warning: Use orange
- Error: Use red
- Info: Use blue
- Always maintain text readability

## Technical Specifications

### File Formats
- **Charts**: SVG (vector) or PNG (raster) at 2x resolution
- **Tables**: HTML with proper semantic markup
- **Reports**: PDF/A for archival
- **Dashboards**: Responsive HTML5

### Performance
- Lazy load charts below the fold
- Virtualize large tables (>1000 rows)
- Debounce interactive updates
- Use WebGL for >10,000 data points

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- No IE11 support

## Integration with IMACX Systems

### Database Fields
- Format dates: `DD/MM/YYYY` (Portuguese standard)
- Numbers: Space as thousand separator
- Currency: EUR (€) symbol after value
- Percentages: No decimal for whole numbers

### PHC Integration
- Respect PHC field naming conventions
- Handle Portuguese characters (ç, ã, õ, etc.)
- Timezone: WET/WEST (Lisbon)
- Fiscal year: January to December

## Validation Checklist

Before deploying any chart or table:
- [ ] No rounded corners visible
- [ ] All text in Atkinson Hyperlegible
- [ ] Text transform applied (UPPERCASE)
- [ ] OKLCH colors used exclusively
- [ ] Borders are 1px solid
- [ ] No shadows or 3D effects
- [ ] Accessibility standards met
- [ ] Mobile responsive
- [ ] Dark mode tested
- [ ] Logo placement correct (if applicable)

## Error States

### No Data
- Show clear message: "SEM DADOS DISPONÍVEIS"
- Maintain layout structure
- Provide action if applicable

### Loading States
- Simple spinner or progress bar
- No fancy animations
- Text: "A CARREGAR..."

### Error Messages
- Clear, actionable text
- Error code if applicable
- Contact info for support

---

# END OF IMACX CHARTS & TABLES SKILL