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
  // Brand palette - subtle Azeroth warmth
  ink: "#201816",           // Primary text, dark backgrounds
  ember: "#b8582a",         // Warm accent, energy, profit indicators
  brass: "#d5ad6d",         // Gold/secondary accent, interactive states
  moss: "#56624f",          // Muted green, stable/calm states
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
  },

  // Semantic status colors
  status: {
    success: {
      bg: "#dcfce7",        // emerald-100
      text: "#166534",      // emerald-700
      border: "#bbf7d0",    // emerald-200
    },
    warning: {
      bg: "#fef3c7",        // amber-100
      text: "#92400e",      // amber-800
      border: "#fde68a",    // amber-200
    },
    danger: {
      bg: "#ffe4e6",        // rose-100
      text: "#be185d",      // rose-700
      border: "#fbcfe8",    // rose-200
    },
    info: {
      bg: "#ecf0ff",        // blue-100
      text: "#1e3a8a",      // blue-800
      border: "#dbeafe",    // blue-200
    },
    muted: {
      bg: "#f1f5f9",        // slate-100
      text: "#475569",      // slate-600
      border: "#cbd5e1",    // slate-200
    },
  },

  // Surface hierarchy
  surface: {
    background: "#fff6e7",  // App background color
    card: "#ffffff",        // Card/panel background
    cardOverlay: "rgba(255, 255, 255, 0.85)", // Card with backdrop blur
    cardHover: "#f8fafc",   // Card hover state
    inputBg: "#ffffff",
    elevated: "rgba(255, 255, 255, 0.95)",
  },

  // Semantic text
  text: {
    primary: "#201816",     // ink
    secondary: "#64748b",   // slate-500
    tertiary: "#94a3b8",    // slate-400 (muted/helper text)
    interactive: "#b8582a", // ember (links, active states)
    disabled: "#cbd5e1",    // slate-300
  },

  // Borders & dividers
  border: "#e2e8f0",        // slate-200, subtle dividers
  borderLight: "#f1f5f9",   // slate-100, very subtle
  borderStrong: "#cbd5e1",  // slate-300, stronger emphasis
} as const;

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const typography = {
  // Font families
  font: {
    display: '"Trebuchet MS", "Gill Sans", sans-serif',  // Brand headings
    body: '"Segoe UI", "Trebuchet MS", sans-serif',      // Body text
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
  },

  // Semantic text styles (combine font family + size + weight)
  styles: {
    pageTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1.875rem",
      fontWeight: 700,
      lineHeight: "2.25rem",
      letterSpacing: "0.3em",
    },
    sectionTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: "1.75rem",
      letterSpacing: "0.16em",
    },
    cardTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: "1.5rem",
    },
    tableHeader: {
      fontFamily: "var(--font-body)",
      fontSize: "0.6875rem",
      fontWeight: 600,
      lineHeight: "1rem",
      letterSpacing: "0.16em",
      textTransform: "uppercase" as const,
    },
    tableCell: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: "1.25rem",
    },
    tableEmphasis: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: "1.25rem",
    },
    label: {
      fontFamily: "var(--font-body)",
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: "1.25rem",
    },
    labelMini: {
      fontFamily: "var(--font-body)",
      fontSize: "0.75rem",
      fontWeight: 600,
      lineHeight: "1rem",
      letterSpacing: "0.05em",
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
    sm: "0 1px 2px 0 rgba(32, 24, 22, 0.05)",
    base: "0 4px 6px -1px rgba(32, 24, 22, 0.1)",
    md: "0 10px 15px -3px rgba(32, 24, 22, 0.1)",
    lg: "0 18px 40px rgba(32, 24, 22, 0.12)",  // card shadow
    xl: "0 25px 50px -12px rgba(32, 24, 22, 0.15)",
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
    outline: `0 0 0 3px rgba(184, 88, 42, 0.1)`, // ember with transparency
    ring: "0 0 0 2px white, 0 0 0 4px var(--color-ember)",
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
      bg: "bg-ink",
      text: "text-white",
      border: "border border-ink",
      hover: "hover:bg-slate-700",
      active: "active:bg-slate-800",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    secondary: {
      bg: "bg-white",
      text: "text-ink",
      border: "border border-slate-200",
      hover: "hover:bg-slate-50",
      active: "active:bg-slate-100",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    accent: {
      bg: "bg-ember",
      text: "text-white",
      border: "border border-ember",
      hover: "hover:bg-orange-700",
      active: "active:bg-orange-800",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    ghost: {
      bg: "bg-transparent",
      text: "text-ink",
      border: "border border-transparent",
      hover: "hover:bg-slate-100",
      active: "active:bg-slate-200",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    danger: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border border-rose-200",
      hover: "hover:bg-rose-100",
      active: "active:bg-rose-200",
      disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
    },
  },

  // Badge variants (semantic, not just color)
  badge: {
    neutral: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-200",
    },
    success: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    warning: {
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
    },
    danger: {
      bg: "bg-rose-100",
      text: "text-rose-700",
      border: "border-rose-200",
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
