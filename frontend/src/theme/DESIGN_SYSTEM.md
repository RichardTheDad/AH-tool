# AzerothFlip Design System

A premium, cohesive UI design for cross-realm WoW auction house market scanning.

## Overview

The AzerothFlip design system provides a standardized, maintainable foundation for building consistent user experiences across all pages. It combines:

- **Color tokens** for semantic meaning and Azeroth-inspired warmth
- **Typography scale** for clear information hierarchy
- **Spacing system** for rhythm and breathing room
- **Shared component primitives** for consistency and maintainability
- **Interactive patterns** for familiar, predictable user interactions

## Design Principles

1. **Premium, not cosplay** — Subtle Azeroth warmth without fantasy theatre
2. **Clean and sharp** — High readability and visual clarity
3. **Dense but breathable** — Efficient scanning UI with good spacing
4. **Professional first** — Serves traders, not theme park visitors
5. **Intentional hierarchy** — Decision-critical data first, secondary info below
6. **Consistency over novelty** — Predictable, learned patterns

## Color Palette

### Brand Colors
- **Ink** (#201816) — Primary text and dark backgrounds
- **Ember** (#b8582a) — Warm accent, profit indicators, interactive elements
- **Brass** (#d5ad6d) — Secondary accent, warmth, historical reference
- **Moss** (#56624f) — Calm, stability, secondary states

### Semantic Colors
- **Success** — emerald (#166534 text, #dcfce7 background)
- **Warning** — amber (#92400e text, #fef3c7 background)
- **Danger** — rose (#be185d text, #ffe4e6 background)
- **Info** — blue (#1e3a8a text, #ecf0ff background)

### Neutral Scale
Slate with 9 levels (50–900) for flexible surface hierarchy:
- Slate-50 through Slate-900 provide consistent neutral backgrounds and borders

## Typography

### Font Families
- **Display** — Trebuchet MS, Gill Sans (brand headings, emphasis)
- **Body** — Segoe UI, Trebuchet MS (general text)

### Scale
| Name | Size | Weight | Use |
|------|------|--------|-----|
| xs | 12px | 400 | Meta, hints, small labels |
| sm | 14px | 400 | Body text, form labels |
| base | 16px | 400 | Standard body paragraphs |
| lg | 18px | 500 | Section emphasis |
| xl | 20px | 600 | Card headings |
| 2xl | 24px | 600 | Page sections |
| 3xl | 30px | 700 | Page titles |

### Semantic Styles
- **Page title** — 30px, 700 weight, display font, letter-spacing 0.3em
- **Section title** — 18px, 600 weight, display font, letter-spacing 0.16em
- **Card title** — 16px, 600 weight, display font
- **Table header** — 11px, 600 weight, uppercase, letter-spacing 0.16em
- **Table cell** — 14px, 400 weight
- **Table emphasis** — 14px, 600 weight (for profit/ROI)
- **Label** — 14px, 500 weight
- **Meta** — 12px, 400 weight, slate-500

## Spacing

All spacing units use a 0.25rem base (4px):

| Scale | Value | Use |
|-------|-------|-----|
| 0.5 | 2px | Micro-adjustments |
| 1 | 4px | Tight spacing |
| 2 | 8px | Default padding |
| 3 | 12px | Standard gaps |
| 4 | 16px | Default padding |
| 6 | 24px | Major section gaps |
| 8 | 32px | Large gaps |

### Semantic Spacing
- **Page padding** — 24px on desktop, 16px on mobile
- **Section gap** — 24px between major sections
- **Card padding** — 20px standard, 16px dense/tables
- **Control spacing** — 12px between form fields
- **Table row padding** — 12px vertical, 16px horizontal

## Shape & Elevation

### Border Radius
| Name | Value | Use |
|------|-------|-----|
| sm | 6px | Subtle rounding (inputs) |
| base | 8px | Default (button outlines) |
| md | 12px | Medium cards |
| lg | 16px | Large containers |
| xl | 24px | Major sections |
| full | 9999px | Buttons, pills |

### Shadows
- **sm**: Light shadows for hover states
- **base**: Default card shadows
- **md**: Elevated alerts and overlays
- **lg**: Primary card shadow (used in `.panel-glow`)
- **xl**: Modal and top-level overlay shadows

### Borders
- **subtle** — 1px, slate-200
- **strong** — 1px, slate-300 or semantic color

## Component Variants

### Buttons
Four primary variants available via the `<Button>` component:

- **primary** — Solid ink background (default action)
- **secondary** — White with slate border (alternative action)
- **accent** — Solid ember background (important actions)
- **danger** — Rose background (destructive)
- **ghost** — Transparent until hover (tertiary actions)

Sizes: `sm` (small), `md` (medium), `lg` (large)

### Badges & Status
Two semantic patterns:

**Badge** — Use for categorical tags:
```tsx
<Badge tone="neutral" | "success" | "warning" | "danger">
  {content}
</Badge>
```

**StatusIndicator** — Use for semantic status display:
```tsx
<StatusIndicator 
  status="success" | "warning" | "danger" | "info" | "muted"
  variant="badge" | "pill" | "dot" | "inline"
  size="sm" | "md" | "lg"
  label="Label text"
/>
```

### Tables
- **Header**: bg-slate-50, uppercase text-xs, slate-600 text
- **Rows**: divide-y divide-slate-100, hover:bg-slate-50
- **Financial columns**: bold, emerald-700 text
- **Metadata**: text-xs, slate-500

### Cards
Three variants via `<Card>` component:

- **default** — White/85 with backdrop blur (standard cards)
- **elevated** — White/95 with stronger blur (prominent panels)
- **flat** — Solid white with subtle border (minimal emphasis)

## Forms

### Input
- **Border** — slate-200, focus:border-ember
- **Radius** — 8px (lg)
- **Padding** — 12px horizontal, 8px vertical standard; 6px/10px compact
- **Focus ring** — ember ring-2 with 10% opacity

### Select
- Same styling as Input
- Clear visual distinction from buttons

### Checkbox
- **Size** — 5px (md), 4px (sm compact)
- **Color** — ember when checked, slate-300 border at default
- **Spacing** — 12px gap (md), 8px (compact)

## States & Transitions

### Interactive States
- **Hover** — Subtle background shift or opacity change
- **Active/Pressed** — Darker shade of primary color
- **Disabled** — 50% opacity, not-allowed cursor
- **Loading** — Spinning loader with current text color

### Focus States
- **Keyboard focus** — 2px ring, ember color with 10% opacity
- **Visible at all times** for accessibility

### Transitions
- **Default**: 0.2s cubic-bezier(0.4, 0, 0.2, 1)
- **Fast**: 0.15s same curve
- **Slow**: 0.3s same curve

## Empty & Error States

### Empty States
- Icon (optional)
- Clear title
- Helpful description
- Action button (if applicable)
- Subtle dashed border, light background

### Error States
- Bold title ("Something went wrong")
- Clear error message
- Optional retry action
- Rose color scheme (rose-50 bg, rose-600 text)

### Loading States
- Centered spinner
- Loading message
- Light background
- Communicates wait time if known

## Layout Patterns

### Page Layout
```
<AppShell>
  <main>
    <PageTitle />
    <PageContent>
      <TwoColumnLayout>
        <Sidebar />
        <MainContent />
      </TwoColumnLayout>
    </PageContent>
  </main>
</AppShell>
```

### Grid Breakpoints
- **Mobile** — Single column, full width
- **lg** (1024px) — Two column recommended
- **xl** (1280px) — Two or three column layout
- **2xl** (1536px) — Wider columns, more breathing room

### Common Layouts
- **Sidebar + Content** — 260-360px sidebar on xl+, full width below
- **Three-up Cards** — lg:grid-cols-[1.2fr_0.8fr_0.8fr] for dashboard
- **Form + List** — 360px form sidebar + list on lg+

## Accessibility

### Contrast
- All text meets WCAG AA minimum 4.5:1 for body, 3:1 for large text
- Semantic status communicated through color + text/icon

### Focus Indicators
- 2px visible ring on all interactive elements
- High contrast (ember on white)
- No outline removal or hidden focus

### Semantic HTML
- Use proper heading levels (h1, h2, h3)
- Form labels explicitly associated via for/id
- Buttons for actions, links for navigation
- ARIA labels where needed for non-obvious intent

## File Structure

```
frontend/src/
├── theme/
│   └── design-system.ts          # Token definitions
├── components/common/
│   ├── Button.tsx                # Button component
│   ├── Input.tsx                 # Input component
│   ├── Select.tsx                # Select component
│   ├── Checkbox.tsx              # Checkbox component
│   ├── FormField.tsx             # Form field wrapper
│   ├── Link.tsx                  # Link component
│   ├── StatusIndicator.tsx       # Status display component
│   ├── Badge.tsx                 # Badge component (categorical)
│   ├── Card.tsx                  # Card container
│   ├── EmptyState.tsx            # Empty state
│   ├── ErrorState.tsx            # Error state
│   └── LoadingState.tsx          # Loading state
├── components/layout/
│   └── AppShell.tsx              # Main layout wrapper
└── pages/
    └── [Page components using shared primitives]
```

## Usage Examples

### Form with Validation
```tsx
<FormField label="Preset name" error={error} required>
  <Input
    value={form.name}
    onChange={(e) => setForm({ ...form, name: e.target.value })}
  />
</FormField>
```

### Button Group
```tsx
<div className="flex gap-2">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</div>
```

### Status Display
```tsx
<StatusIndicator 
  status={realm.active ? "success" : "warning"} 
  variant="pill" 
  label={realm.active ? "Active" : "Inactive"} 
/>
```

### Card with Action
```tsx
<Card title="Opportunities" subtitle="Top 5 flips today">
  <ScannerTable results={results} />
  <div className="mt-4">
    <Link to="/scanner">View all →</Link>
  </div>
</Card>
```

## Migration Guide

### From Old Inline Styles
Replace scattered button styles:
```tsx
// Old
<button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
  Save
</button>

// New
<Button>Save</Button>
```

Replace form inputs:
```tsx
// Old
<input className="rounded-xl border border-slate-200 bg-white px-3 py-2" />

// New
<Input label="Field name" />
```

Replace scattered badge styles:
```tsx
// Old
<span className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 border px-2.5 py-1 text-xs font-semibold">
  Fresh
</span>

// New
<StatusIndicator status="success" size="sm" variant="badge" label="Fresh" />
```

## Maintenance Notes

### Color Consistency
- Use semantic colors in `.env` for branding
- Never hardcode hex colors outside the design-system.ts
- Update token definitions centrally for brand changes

### Typography
- Always use named scales (xs, sm, base, lg, xl, 2xl, 3xl)
- Don't create custom sizes; use the nearest scale
- Use semantic style names (sectionTitle, tableHeader, etc.)

### Spacing
- Prefer named spacing scales over arbitrary Tailwind values
- Use consistent gaps between sections (spacing.section.gap)
- Keep padding symmetrical unless intentional

### Component Usage
- Use shared Button, Input, Select, Checkbox components
- Import from `components/common/`
- Pass variants, sizes, states as props instead of className hacks

### Layout Responsiveness
- Mobile-first approach (start with single-column)
- Add multi-column with lg: and xl: breakpoints
- Test at 320px, 640px, 1024px, 1280px, 1536px

## Related Files

- **index.css** — Global styles and `.panel-glow` mixin
- **tailwind.config.ts** — Theme extensions
- **App.tsx** — Layout wrapper and routing
- **AppShell.tsx** — Header and navigation
