import { Pressable, type PressableProps } from "react-native";

import { pressedOpacity } from "@/theme";

/**
 * The app's default Pressable: every tap target dims to the same `pressedOpacity` while held. A function `style`
 * is passed through untouched, so a caller that draws its own pressed state keeps it.
 */
export function Tappable({ style, ...rest }: PressableProps) {
  if (typeof style === "function") return <Pressable style={style} {...rest} />;
  return <Pressable {...rest} style={({ pressed }) => [style, pressed && !rest.disabled && { opacity: pressedOpacity }]} />;
}
