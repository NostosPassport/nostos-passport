import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { bookStyle, colors } from "@/theme";

/** The paper of one page: near-black stock with a fine inset rule. Every page of the book is drawn on one. */
export function PageStock({ width, height, children }: { width: number; height: number; children?: ReactNode }) {
  return (
    <View style={[{ width, height }, styles.stock]}>
      <View pointerEvents="none" style={[styles.rule, { margin: Math.round(width * 0.04) }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stock: { backgroundColor: colors.surface, overflow: "hidden" },
  rule: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: bookStyle.pageLine, borderColor: colors.hairline },
});
