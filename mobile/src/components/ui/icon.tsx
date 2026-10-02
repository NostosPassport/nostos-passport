import { SymbolView, type SymbolViewProps } from "expo-symbols";

import { colors, size as sizes, type ColorToken, type VibeColor } from "@/theme";

export type SymbolName = Extract<SymbolViewProps["name"], string>;

type Props = {
  name: SymbolName;
  color?: ColorToken;
  /** Vibe-colored symbols only. Everything else uses `color`. */
  tint?: VibeColor;
  size?: number;
  weight?: SymbolViewProps["weight"];
};

/** SF Symbols only. Decorative by default: the control around it carries the label. */
export function Icon({ name, color = "textPrimary", tint, size = sizes.icon, weight = "semibold" }: Props) {
  return (
    <SymbolView
      name={name}
      size={size}
      weight={weight}
      tintColor={tint ?? colors[color]}
      accessible={false}
      importantForAccessibility="no"
      style={{ width: size, height: size }}
    />
  );
}
