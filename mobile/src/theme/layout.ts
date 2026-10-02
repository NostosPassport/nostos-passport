/** Spacing, shape and size tokens. 4pt grid. */
import { StyleSheet } from "react-native";

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Horizontal padding for every screen. */
export const screenPadding = space.lg;

export const radius = {
  chip: 10,
  button: 14,
  card: 14,
  largeCard: 20,
  sheet: 28,
  pill: 999,
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

/** Fixed component sizes. Hit targets are never below `hitTarget`. */
export const size = {
  hitTarget: 44,
  buttonHeight: 50,
  fieldHeight: 50,
  /** Width of the inline label column in grouped forms. */
  fieldLabel: 96,
  checkbox: 24,
  iconTiny: 14,
  iconSmall: 17,
  icon: 20,
  iconLarge: 28,
  avatarSmall: 24,
  avatar: 36,
  avatarLarge: 72,
  /** Verified diamond next to a handle, and the check inside it. */
  verifiedBadge: 13,
  verifiedCheck: 7,
  verifiedCorner: 2,
  /** Placeholder height for a post's photo while it loads. */
  postPhotoSkeleton: 360,
  vibeDot: 10,
  marker: 28,
  markerRing: 2,
  markerBadge: 16,
  listRow: 68,
  heroHeight: 220,
  borderEmphasis: 1.5,
} as const;

/** Width / height of media frames. */
export const aspect = { post: 4 / 5 } as const;

/** The verified diamond is a square turned 45 degrees, scaled to sit inside its box. */
export const verifiedDiamondScale = 0.78;

/** Stacked friend avatars overlap by this much. */
export const avatarOverlap = -8;
