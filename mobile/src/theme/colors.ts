/**
 * Color tokens. The only place in the app where raw color values may appear
 * (enforced by the `local/no-raw-design-values` lint rule).
 */
export const colors = {
  background: "#0A0A0D",
  surface: "#141419",
  elevated: "#1C1C23",
  hairline: "rgba(255,255,255,0.08)",

  textPrimary: "#F5F5F7",
  textSecondary: "#A1A1AA",
  textTertiary: "#6B6B76",

  /** The one accent: brand, primary buttons, selection. */
  accent: "#FFB224",
  accentPressed: "#E89E14",
  onAccent: "#1A1200",

  /** The verified badge only: a pale champagne, never the accent, never blue. */
  verified: "#E6D3B3",
  onVerified: "#1A1409",

  success: "#34C759",
  warning: "#FFB224",
  danger: "#FF453A",

  /** Scrim behind modal sheets and over photos. */
  scrim: "rgba(0,0,0,0.55)",
  /** Pressed-state overlay on dark surfaces. */
  pressedOverlay: "rgba(255,255,255,0.06)",
  transparent: "transparent",
} as const;

export type ColorToken = keyof typeof colors;
