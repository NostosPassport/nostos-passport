/**
 * MIDNIGHT: the one theme. Black and brass gold, nothing else. This is the ONLY file in the app where a color literal may
 * appear (a test fails on any literal elsewhere, and on any white value anywhere). Every visual decision (colors, type,
 * radii, spacing, shadows, motion, stamp styles) is read from this object, so a screen can be replaced without touching
 * the look: imported screens just use `midnight` (or the `colors`, `type`, `space` ... re-exports in this folder).
 *
 * Rules of the palette:
 *  - No other hue. Not even for errors: errors and states are brass, dim brass, bone text, icons and words.
 *  - Nothing is white. The lightest value is bone (#E8E4DC). User photos and album art are exempt; UI chrome is not.
 *  - Color is never the only signal: pair it with a word, a shape or an icon.
 */

/** The eight solid colors. Everything else in this file is one of these with an alpha. */
export const palette = {
  black: "#000000",
  ink: "#0B0B0D",
  inkRaised: "#141418",
  brass: "#C9A24B",
  dimBrass: "#8F7434",
  bone: "#E8E4DC",
  boneDim: "#A09C94",
  boneFaint: "#6B6862",
} as const;

const BRASS_RGB = "201,162,75";
const BONE_RGB = "232,228,220";
const BLACK_RGB = "0,0,0";

export const colors = {
  /** Screen background: pure black, so the OLED turns off and the brass glows. */
  background: palette.black,
  /** Page stock and cards. */
  surface: palette.ink,
  elevated: palette.inkRaised,
  /** Fine rules and borders: brass at low strength. */
  hairline: `rgba(${BRASS_RGB},0.18)`,

  textPrimary: palette.bone,
  textSecondary: palette.boneDim,
  textTertiary: palette.boneFaint,

  /** The one accent: brass. Primary buttons, selection, foil. */
  accent: palette.brass,
  accentPressed: palette.dimBrass,
  /** Text and icons on brass. */
  onAccent: palette.black,

  /** The verified badge is brass like everything that matters. */
  verified: palette.brass,
  onVerified: palette.black,

  /** States share the palette. They are told apart by words and icons, never by hue. */
  success: palette.brass,
  warning: palette.brass,
  danger: palette.brass,

  /** Behind sheets and over photos. */
  scrim: `rgba(${BLACK_RGB},0.6)`,
  pressedOverlay: `rgba(${BRASS_RGB},0.08)`,
  transparent: "transparent",

  // The brass family, named for the passport.
  black: palette.black,
  ink: palette.ink,
  inkRaised: palette.inkRaised,
  brass: palette.brass,
  dimBrass: palette.dimBrass,
  /** Foil glow: a soft brass halo around stamps, the cover and active pins. */
  brassGlow: `rgba(${BRASS_RGB},0.35)`,
  brassGlowSoft: `rgba(${BRASS_RGB},0.14)`,
  /** The moving highlight on foil: bone, not white. */
  foilHighlight: `rgba(${BONE_RGB},0.5)`,
  bone: palette.bone,
  boneDim: palette.boneDim,
  boneFaint: palette.boneFaint,
  /** Shadow tint (black) and the paper grain (bone at very low strength). */
  shadow: palette.black,
  grain: `rgba(${BONE_RGB},0.045)`,
  /** Leather: near-black with a brass sheen at the edges. */
  leather: palette.ink,
  leatherSheen: `rgba(${BRASS_RGB},0.07)`,
} as const;

export type ColorToken = keyof typeof colors;

/** Type families. Titles and stamp text: a refined serif. Dates and captions: a typewriter mono. UI: the system sans (SF Pro). */
export const fonts = {
  serif: "CormorantGaramond_600SemiBold",
  serifItalic: "CormorantGaramond_500Medium_Italic",
  serifRegular: "CormorantGaramond_500Medium",
  mono: "CourierPrime_400Regular",
  monoBold: "CourierPrime_700Bold",
  /** The system font (undefined = platform default, SF Pro on iOS). */
  sans: undefined,
} as const;

/**
 * Shadows. Layered, not flat: a tight contact shadow plus a wide soft one. iOS shadow props; shadows are black, and a
 * brass glow variant is used for lit foil.
 */
export const shadows = {
  contact: { shadowColor: colors.shadow, shadowOpacity: 0.55, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  soft: { shadowColor: colors.shadow, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  book: { shadowColor: colors.shadow, shadowOpacity: 0.8, shadowRadius: 34, shadowOffset: { width: 0, height: 22 } },
  page: { shadowColor: colors.shadow, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  glow: { shadowColor: colors.brass, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
} as const;

/** Motion for the book. Springs, never linear tweens. Quiet everywhere except the foil, the page flip and the stamp landing. */
export const bookMotion = {
  /** Cover opening: a heavy swing that settles. */
  coverOpen: { damping: 18, stiffness: 90, mass: 1.1 },
  /** Page turn released by the finger. */
  pageFlip: { damping: 20, stiffness: 140, mass: 0.9 },
  /** The stamp slamming down. */
  stampSlam: { damping: 11, stiffness: 260, mass: 0.7 },
  /** Small UI. */
  snap: { damping: 22, stiffness: 320, mass: 0.6 },
  durations: { fast: 150, standard: 250, ink: 420, glow: 900, crossfade: 220, shimmer: 2600 },
} as const;

/** How stamps look. Variety comes from SHAPE and DESIGN, never color: ink is always brass. */
export const stampStyle = {
  ink: colors.brass,
  inkDim: colors.dimBrass,
  glow: colors.brassGlow,
  /** 0..1 strength of the rough, uneven edge and of the missing ink. */
  roughness: 0.55,
  partialFill: 0.18,
  /** Stroke widths for rings, rules and text in a stamp (pt at a 120 pt stamp). */
  strokes: { ring: 3, hair: 1.2, text: 2 },
  /** Largest tilt a stamp is given, in degrees. */
  maxTiltDeg: 11,
  /** Overlap allowed between neighbors, as a share of the stamp. */
  maxOverlap: 0.12,
} as const;

/** The whole theme as one object, for components that take "the theme". */
export const midnight = { name: "Midnight", palette, colors, fonts, shadows, bookMotion, stampStyle } as const;
export type Theme = typeof midnight;
