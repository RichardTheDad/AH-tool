/**
 * AzerothFlip Design System
 * Premium market scanner UI with subtle Azeroth flavor
 * 
 * Design principles:
 * - Clean, sharp, and practical
 * - Dense enough for efficient scanning
 * - Professional, readable, and modern
 * - Subtle Azeroth warmth, not cosplay fantasy
 * - Strong visual hierarchy
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  // Brand palette - dark glass baseline
  ink: "#f4f4f5",           // Primary text on dark surfaces
  ember: "#f97316",         // Primary accent and CTA energy
  brass: "#f59e0b",         // Secondary accent and highlights
  moss: "#34d399",          // Success/positive signal accent
  slate: {
    50: "#27272a",
    100: "#3f3f46",
    200: "#52525b",
    300: "#71717a",
    400: "#a1a1aa",
    500: "#d4d4d8",
    600: "#e4e4e7",
    700: "#f4f4f5",
  },

  // Semantic status colors
  status: {
    success: {
      bg: "rgba(52, 211, 153, 0.12)",
      text: "#34d399",
      border: "rgba(52, 211, 153, 0.35)",
    },
    warning: {
      bg: "rgba(251, 146, 60, 0.12)",
      text: "#fb923c",
      border: "rgba(251, 146, 60, 0.35)",
    },
    danger: {
      bg: "rgba(251, 113, 133, 0.12)",
      text: "#fb7185",
      border: "rgba(251, 113, 133, 0.35)",
    },
    info: {
      bg: "rgba(59, 130, 246, 0.12)",
      text: "#60a5fa",
      border: "rgba(96, 165, 250, 0.35)",
    },
    muted: {
      bg: "rgba(255, 255, 255, 0.05)",
      text: "#a1a1aa",
      border: "rgba(255, 255, 255, 0.15)",
    },
  },

  // Surface hierarchy
  surface: {
    background: "#09090b",
    card: "#0f172a",
    cardOverlay: "rgba(255, 255, 255, 0.03)",
    cardHover: "rgba(255, 255, 255, 0.06)",
    inputBg: "rgba(255, 255, 255, 0.04)",
    elevated: "rgba(255, 255, 255, 0.05)",
  },

  // Semantic text
  text: {
    primary: "#f4f4f5",
    secondary: "#d4d4d8",
    tertiary: "#a1a1aa",
    interactive: "#fb923c",
    disabled: "#71717a",
  },

  // Borders & dividers
  border: "rgba(255, 255, 255, 0.15)",
  borderLight: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.24)",
} as const;

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const typography = {
  // Font families
  font: {
    display: '"Sora", "Segoe UI", sans-serif',
    body: '"Sora", "Segoe UI", sans-serif',
  },

  // Font sizes with line heights
  scale: {
    xs: { size: "0.75rem", lineHeight: "1rem", weight: 400 },      // 12px
    sm: { size: "0.875rem", lineHeight: "1.25rem", weight: 400 },  // 14px
    base: { size: "1rem", lineHeight: "1.5rem", weight: 400 },     // 16px
    lg: { size: "1.125rem", lineHeight: "1.75rem", weight: 500 },  // 18px
    xl: { size: "1.25rem", lineHeight: "1.75rem", weight: 600 },   // 20px
    "2xl": { size: "1.5rem", lineHeight: "2rem", weight: 600 },    // 24px
    "3xl": { size: "1.875rem", lineHeight: "2.25rem", weight: 700 }, // 30px
    "4xl": { size: "2rem", lineHeight: "2.5rem", weight: 700 },    // 32px
    "5xl": { size: "2.75rem", lineHeight: "3rem", weight: 700 },    // 44px
  },

  // Semantic text styles (combine font family + size + weight)
  styles: {
    pageTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1.875rem",
      fontWeight: 700,
      lineHeight: "2.25rem",
      letterSpacing: "0.02em",
    },
    sectionTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: "1.75rem",
      letterSpacing: "0.16em",
      color: "var(--text-primary)",
    },
    cardTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: "1.5rem",
      color: "var(--text-primary)",
    },
    tableHeader: {
      fontFamily: "var(--font-body)",
      fontSize: "0.6875rem",
      fontWeight: 600,
      lineHeight: "1rem",
      letterSpacing: "0.16em",
      textTransform: "uppercase" as const,
      color: "var(--text-tertiary)",
    },
    tableCell: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: "1.25rem",
      color: "var(--text-secondary)",
    },
    tableEmphasis: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: "1.25rem",
      color: "var(--text-primary)",
    },
    label: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: "1.25rem",
      color: "var(--text-secondary)",
    },
    labelMini: {
      fontFamily: "var(--font-body)",
      fontSize: "0.75rem",
      fontWeight: 600,
      lineHeight: "1rem",
      letterSpacing: "0.05em",
      color: "var(--text-tertiary)",
    },
    meta: {
      fontFamily: "var(--font-body)",
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: "1rem",
      color: "var(--text-tertiary)",
    },
  },
} as const;

// ============================================================================
// SPACING SCALE
// ============================================================================

export const spacing = {
  // Consistent spacing scale
  px: {
    0: "0",
    0.5: "0.125rem",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
  },

  // Semantic spacing
  page: {
    padding: "1.5rem",      // Page edge padding
    paddingLg: "2rem",      // Large page padding
  },
  section: {
    gap: "1.5rem",          // Between major sections
    gapCompact: "1rem",     // Compact view sections
  },
  card: {
    padding: "1.25rem",     // Standard card padding
    paddingDense: "1rem",   // Dense/scanner tables
  },
  control: {
    spacing: "0.75rem",     // Between form fields
    gapHorizontal: "0.5rem", // Horizontal gaps (buttons side by side)
  },
  table: {
    rowPadding: "0.75rem",  // Table cell vertical padding
    colPadding: "1rem",     // Table cell horizontal padding
    rowGap: "0.5rem",       // Between table rows
  },
} as const;

// ============================================================================
// SHAPE & ELEVATION
// ============================================================================

export const shape = {
  radius: {
    sm: "0.375rem",         // 6px - inputs, subtle
    base: "0.5rem",         // 8px - default
    md: "0.75rem",          // 12px - medium cards
    lg: "1rem",             // 16px - large cards, panels
    xl: "1.5rem",           // 24px - major containers
    full: "9999px",         // Buttons, pills
  },

  shadow: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.25)",
    base: "0 4px 12px -2px rgba(0, 0, 0, 0.35)",
    md: "0 12px 24px -6px rgba(0, 0, 0, 0.45)",
    lg: "0 22px 50px rgba(0, 0, 0, 0.5)",
    xl: "0 30px 60px -15px rgba(0, 0, 0, 0.55)",
  },

  border: {
    base: "1px solid",
    strong: "2px solid",
  },
} as const;

// ============================================================================
// INTERACTIVE STATES
// ============================================================================

export const states = {
  // Opacity helpers
  opacity: {
    disabled: 0.5,
    hover: 0.9,
    active: 0.8,
  },

  // Focus states for accessibility
  focus: {
    outline: `0 0 0 3px rgba(249, 115, 22, 0.25)`,
    ring: "0 0 0 2px rgba(9, 9, 11, 0.95), 0 0 0 4px var(--color-ember)",
  },

  // Transition helpers
  transition: {
    default: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    fast: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

// ============================================================================
// COMPONENT VARIANTS
// ============================================================================

export const variants = {
  // Button variants
  button: {
    primary: {
      bg: "bg-orange-500",
      text: "text-white",
      border: "border border-orange-500",
      hover: "hover:bg-orange-400",
      active: "active:bg-orange-600",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    secondary: {
      bg: "bg-white/5",
      text: "text-zinc-100",
      border: "border border-white/15",
      hover: "hover:bg-white/10",
      active: "active:bg-white/15",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    accent: {
      bg: "bg-emerald-500/20",
      text: "text-white",
      border: "border border-emerald-400/35",
      hover: "hover:bg-emerald-500/30",
      active: "active:bg-emerald-500/40",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    ghost: {
      bg: "bg-transparent",
      text: "text-zinc-300",
      border: "border border-transparent",
      hover: "hover:bg-white/10 hover:text-zinc-100",
      active: "active:bg-white/15",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    danger: {
      bg: "bg-rose-500/15",
      text: "text-rose-300",
      border: "border border-rose-400/35",
      hover: "hover:bg-rose-500/25",
      active: "active:bg-rose-500/35",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
  },

  // Badge variants (semantic, not just color)
  badge: {
    neutral: {
      bg: "bg-white/10",
      text: "text-zinc-200",
      border: "border-white/20",
    },
    success: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-300",
      border: "border-emerald-400/35",
    },
    warning: {
      bg: "bg-amber-500/20",
      text: "text-amber-300",
      border: "border-amber-400/35",
    },
    danger: {
      bg: "bg-rose-500/20",
      text: "text-rose-300",
      border: "border-rose-400/35",
    },
  },
} as const;

// ============================================================================
// EXPORT TYPE DEFINITIONS
// ============================================================================

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing.px;
export type RadiusSize = keyof typeof shape.radius;
export type ShadowSize = keyof typeof shape.shadow;
export type ButtonVariant = keyof typeof variants.button;
export type BadgeVariant = keyof typeof variants.badge;
