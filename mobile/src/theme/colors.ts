/**
 * Color tokens. The only place in the app where raw color values may appear
 * (enforced by the `local/no-raw-design-values` lint rule).
 */
import type { VibeState } from "@/api/contracts";

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

/** Vibe colors are only ever used for vibe. NO_DATA has no fill: draw a hairline outline. */
export const vibeColors = {
  PACKED: "#FF3B5C",
  BUSY: "#FF9F0A",
  CHILL: "#2DD4BF",
  DEAD: "#5B6170",
  NO_DATA: colors.transparent,
} as const satisfies Record<VibeState, string>;

/** A color that may be passed where a token name won't do (e.g. an SF Symbol's tint). */
export type VibeColor = (typeof vibeColors)[VibeState];

/** Low-alpha vibe tints for fallback hero surfaces. */
export const vibeTints: Record<VibeState, string> = {
  PACKED: "rgba(255,59,92,0.16)",
  BUSY: "rgba(255,159,10,0.16)",
  CHILL: "rgba(45,212,191,0.14)",
  DEAD: "rgba(91,97,112,0.18)",
  NO_DATA: colors.elevated,
};

/** Outline for NO_DATA markers and dots: visible on the dark map, unlike the 8% hairline. */
export const noDataOutline = "rgba(255,255,255,0.45)";

export type ColorToken = keyof typeof colors;
