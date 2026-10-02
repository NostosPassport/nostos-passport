import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { colors, maxFontSizeMultiplier, tabular as tabularStyle, type as typeScale, weight as weights, type ColorToken, type TypeVariant } from "@/theme";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  weight?: keyof typeof weights;
  /** Tabular figures for counts and money. */
  tabular?: boolean;
  align?: "left" | "center" | "right";
};

export function Text({ variant = "body", color = "textPrimary", weight, tabular, align, style, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[
        typeScale[variant],
        { color: colors[color] },
        weight && { fontWeight: weights[weight] },
        tabular && tabularStyle,
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
