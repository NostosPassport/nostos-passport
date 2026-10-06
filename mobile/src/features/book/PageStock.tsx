import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { bookStyle, colors } from "@/theme";

export function PageStock({ width, height, spine, children }: { width: number; height: number; spine?: "left" | "right"; children?: ReactNode }) {
  const gutter = Math.max(5, Math.round(width * bookStyle.gutterShare));
  return (
    <View style={[{ width, height }, styles.stock]}>
      <View pointerEvents="none" style={[styles.rule, { margin: Math.round(width * 0.04) }]} />
      {children}
      {spine ? (
        <Svg width={gutter} height={height} style={[styles.fold, spine === "left" ? { left: 0 } : { right: 0 }]} pointerEvents="none">
          <Defs>
            <LinearGradient id={`fold-${spine}`} x1={spine === "left" ? "0" : "1"} y1="0" x2={spine === "left" ? "1" : "0"} y2="0">
              <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0.09} />
              <Stop offset="0.45" stopColor={colors.textPrimary} stopOpacity={0.035} />
              <Stop offset="1" stopColor={colors.textPrimary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={gutter} height={height} fill={`url(#fold-${spine})`} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stock: { backgroundColor: colors.surface, overflow: "hidden" },
  rule: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: bookStyle.pageLine, borderColor: colors.hairline },
  fold: { position: "absolute", top: 0 },
});
