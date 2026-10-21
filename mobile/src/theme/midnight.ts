import { STAMP_ARTWORK_STYLE } from "../../../shared/passport-artwork";

/**
 * EDITORIAL: the shared visual language from the current Nostos Figma refinement.
 *
 * The historical module name is kept so existing imports continue to work while the app is
 * migrated screen by screen. Color literals still live only in this file so the design-token
 * gate can catch accidental one-off styling elsewhere.
 */
export const palette = {
  black: "#F7F4EE",
  ink: "#F3EFE5",
  inkRaised: "#EEE9DD",
  brass: "#123BFF",
  passportBlue: "#5F84D7",
  collectionNavy: "#355078",
  collectionGreen: "#55705F",
  collectionBurgundy: "#7B4E59",
  collectionSand: "#B29872",
  collectionPlum: "#6B587A",
  dimBrass: "#5A5A55",
  bone: "#171714",
  boneDim: "#5A5A55",
  boneFaint: "#74746E",
  danger: "#B3261E",
} as const;

const ACCENT_RGB = "18,59,255";
const INK_RGB = "23,23,20";
const PAPER_RGB = "247,244,238";

export const colors = {
  background: palette.ink,
  surface: palette.black,
  elevated: palette.inkRaised,
  hairline: `rgba(${INK_RGB},0.38)`,

  textPrimary: palette.bone,
  textSecondary: palette.boneDim,
  textTertiary: palette.boneFaint,

  accent: palette.brass,
  accentPressed: palette.dimBrass,
  onAccent: palette.black,

  verified: palette.brass,
  onVerified: palette.black,

  success: palette.brass,
  warning: palette.brass,
  danger: palette.danger,

  scrim: `rgba(${INK_RGB},0.6)`,
  pressedOverlay: `rgba(${ACCENT_RGB},0.08)`,
  transparent: "transparent",

  black: palette.black,
  ink: palette.ink,
  inkRaised: palette.inkRaised,
  brass: palette.brass,
  dimBrass: palette.dimBrass,
  brassGlow: `rgba(${ACCENT_RGB},0.24)`,
  brassGlowSoft: `rgba(${ACCENT_RGB},0.12)`,
  foilHighlight: `rgba(${PAPER_RGB},0.55)`,
  bone: palette.bone,
  boneDim: palette.boneDim,
  boneFaint: palette.boneFaint,
  shadow: palette.bone,
  grain: `rgba(${INK_RGB},0.035)`,
  leather: palette.ink,
  leatherSheen: `rgba(${ACCENT_RGB},0.035)`,
  bookAccent: `rgba(${ACCENT_RGB},0.68)`,
  bookAccentSoft: `rgba(${ACCENT_RGB},0.30)`,
  bookShade: `rgba(${INK_RGB},0.075)`,
  bookFold: `rgba(${INK_RGB},0.08)`,
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  serif: "CormorantGaramond_600SemiBold",
  serifItalic: "CormorantGaramond_500Medium_Italic",
  serifRegular: "CormorantGaramond_500Medium",
  mono: "CourierPrime_400Regular",
  monoBold: "CourierPrime_700Bold",
  sans: undefined,
} as const;

export const shadows = {
  contact: { shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  soft: { shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  book: { shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 16 } },
  page: { shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  glow: { shadowColor: colors.brass, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
} as const;

export const bookMotion = {
  coverOpen: { damping: 18, stiffness: 90, mass: 1.1 },
  pageFlip: { damping: 20, stiffness: 140, mass: 0.9 },
  stampSlam: { damping: 11, stiffness: 260, mass: 0.7 },
  snap: { damping: 22, stiffness: 320, mass: 0.6 },
  durations: { fast: 150, standard: 250, ink: 420, glow: 900, crossfade: 220, shimmer: 2600 },
} as const;

export const stampStyle = {
  ink: colors.brass,
  inkDim: colors.dimBrass,
  glow: colors.brassGlow,
  roughness: 0.55,
  partialFill: 0.18,
  strokes: STAMP_ARTWORK_STYLE.strokes,
  text: STAMP_ARTWORK_STYLE.text,
  maxTiltDeg: STAMP_ARTWORK_STYLE.maxTiltDeg,
  maxOverlap: 0.12,
} as const;

export const bookStyle = {
  borderThick: 2,
  borderHair: 0.8,
  emblemRing: 0.022,
  emblemInner: 0.012,
  emblemTick: 0.01,
  pageLine: 0.6,
  pageRule: 1,
  gutterShare: 0.032,
  edgeLine: 1,
  edgeGap: 2,
  maxEdgeLines: 6,
} as const;

export const midnight = { name: "Editorial", palette, colors, fonts, shadows, bookMotion, bookStyle, stampStyle } as const;
export type Theme = typeof midnight;

/** Scene lighting and the runtime 3D passport cover treatment. */
export const scene3d = {
  background: colors.background,
  softbox: palette.black,
  strip: palette.boneFaint,
  rim: palette.black,
  fill: palette.boneDim,
  floor: palette.inkRaised,
  studio: palette.bone,
  shadow: palette.bone,
  shadowOpacity: 0.55,
  passportCover: palette.passportBlue,
  passportCoverArtwork: palette.black,
  passportCoverRoughness: 0.98,
  passportCoverEnvIntensity: 0.05,
  passportCoverNormalScale: 0.22,
} as const;
