/** SF Pro (the system font) on the iOS type scale. Sizes are size/line-height in points. */
import type { TextStyle } from "react-native";

const scale = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700" },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;

export const type = scale;
export type TypeVariant = keyof typeof scale;

/** Emphasis weights applied on top of a variant. */
export const weight = { regular: "400", medium: "500", semibold: "600", bold: "700" } as const;

/** Counts and money line up in columns. */
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/**
 * Dynamic Type: text scales with the user's setting. Layouts are built to hold at
 * least up to the XL/XXXL sizes; beyond this multiplier text stops growing.
 */
export const maxFontSizeMultiplier = 1.6;
