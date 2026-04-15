# Azeroth Flip Design System (Dark Canonical)

This document defines the canonical UI system for Azeroth Flip.
The default visual mode is dark zinc with orange accents and soft glass surfaces.

## 1) Core Principles

- Product-first clarity: scanner and pricing data are always the focal point.
- Strong hierarchy: high-contrast headings, muted supporting text, clear states.
- Calm density: compact enough for power users, never cramped.
- Surface depth without noise: subtle glow, blur, and translucent layers.
- Token-first implementation: avoid hardcoded ad-hoc colors in feature files.

## 2) Color System

### Brand and Accent

- Primary accent: Ember/Orange used for active, focus, and key action highlights.
- Accent usage: sparing and intentional; avoid flooding large surfaces with pure accent.

### Dark Zinc Foundation

- App background: deep zinc with layered gradients.
- Elevated surfaces: translucent zinc/white overlays with soft borders.
- Borders: low-contrast white alpha to preserve depth without hard lines.

### Semantic States

- Success: emerald family with dark-surface-friendly contrast.
- Warning: amber family with readable text on tinted backgrounds.
- Danger: rose/red family with readable text on tinted backgrounds.
- Info: sky/cyan family with readable text on tinted backgrounds.

## 3) Typography

- Primary UI font: Sora.
- Display font: Cinzel for brand/hero headings where appropriate.
- Body text defaults:
  - High-emphasis text: zinc-100
  - Secondary/support text: zinc-300/400
  - Disabled/low-priority text: zinc-500 (only when contrast remains acceptable)

## 4) Spacing and Shape

- Radius scale:
  - Inputs/buttons/cards: rounded-lg to rounded-xl
  - Hero/highlights: rounded-2xl to rounded-3xl
- Container rhythm:
  - Tight rows in scanner views
  - Breathing room in setup and onboarding sections

## 5) Elevation and Glass

- Base panels use a translucent dark surface with subtle backdrop blur.
- Elevated cards add stronger border alpha and soft ambient shadow.
- Avoid heavy drop shadows that reduce text clarity.

Recommended utility patterns:

- `bg-white/5` or `bg-zinc-900/60`
- `border-white/10` to `border-white/20`
- `backdrop-blur-xl` for top-level glass containers

## 6) Component Standards

### Buttons

- Primary: orange fill, white text.
- Secondary: dark glass surface with light text.
- Ghost: transparent surface with subtle hover tint.
- Focus ring: orange-tinted ring on all interactive button variants.

### Inputs/Selects/Checkboxes

- Field background: translucent dark fill.
- Field border: white alpha border, stronger on focus.
- Label text: zinc-200.
- Hint text: zinc-400.
- Error text: rose-300.

### Cards

- Default card: dark glass surface with subtle border.
- Elevated card: stronger border alpha + deeper shadow.
- Header/body/footer text tokens must follow contrast tiers.

### Badges/Status Indicators

- Use semantic tinted backgrounds with high-contrast foreground text.
- Do not place gray text on saturated semantic backgrounds.

### Links

- Default links: zinc-100 with orange hover for clear affordance.
- Muted links: zinc-400 with zinc-200 hover.

## 7) Layout and Navigation

### App Shell

- Sticky top bar with dark translucent background and blur.
- Active nav state uses orange fill with white text.
- Inactive nav items use zinc text with subtle glass hover states.

### Public Surfaces

- Public pages default to dark presentation.
- Public header supports tone variants, but dark is the default canonical tone.

## 8) Accessibility and Contrast Rules

- Preserve WCAG-friendly contrast for all critical text and controls.
- Never use low-contrast gray text on saturated or tinted backgrounds.
- Gradient text is not used for body copy or key UI labels.
- Focus styles must remain visible on all interactive controls.

## 9) Implementation Rules

- Always compose UI from design tokens and shared primitives first.
- Avoid introducing one-off color utilities inside page-level files.
- Prefer semantic tokens (`text`, `status`, `surface`, `border`) over raw Tailwind shades.
- When adding a new variant, update:
  - `src/theme/design-system.ts`
  - relevant shared primitive in `src/components/common`
  - this document if it changes canonical behavior

## 10) Migration Guidance (Full-App Rollout)

The migration order should remain:

1. Foundation
   - Tokens, global CSS, Tailwind extensions, shared primitives.
2. Shell/Layout
   - App shell, global nav, persistent frame elements.
3. High-traffic pages
   - Dashboard, scanner, suggestions, settings pages.
4. Long-tail pages
   - Detail and utility pages.

Validation expected after each wave:

- Build/TypeScript compile passes.
- Design audit passes (no gradient body text, no gray-on-color contrast issues).
- Quick manual sanity on desktop and mobile breakpoints.

## 11) Anti-Patterns to Avoid

- Reintroducing light-theme defaults into shared components.
- Hardcoding `slate-*` text colors in dark contexts without contrast review.
- Overusing saturated orange fills on large containers.
- Styling form controls ad hoc per page instead of using primitives.

## 12) Scanner and Preset Conventions

- Scanner refresh is scheduler-driven. Do not add manual "run scan" triggers in scanner-facing UI.
- Scanner controls are user-owned filters and presets only.
- Always show mode context:
  - Discovery mode: broad scheduled-scan universe across enabled realms.
  - Focused mode: user realm filters intentionally narrow the same scheduled-scan universe.
- Focused mode should include impact context (for example: shown count vs total baseline).
- Spread presentation should prefer layered context when available:
  - Target spread (% and gold)
  - Observed spread (% and gold)
  - Sale-average spread (% and gold)
- Presets support one user default preset:
  - Set default from preset management surfaces.
  - Provide a reset/apply path so scanner can return to saved default filters quickly.

## 13) Current Canonical References

- Tokens and variants: `src/theme/design-system.ts`
- Global baseline styles: `src/index.css`
- Tailwind extensions: `tailwind.config.ts`
- Shared primitives: `src/components/common/*`
- Layout shell: `src/components/layout/AppShell.tsx`
- Public header: `src/components/layout/PublicHeader.tsx`
