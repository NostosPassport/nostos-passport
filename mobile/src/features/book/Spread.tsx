import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { bookStyle, colors, shadows } from "@/theme";
import { edgeLines } from "./edges";

type Props = {
  /** One page's width and height; the open book is two pages wide. */
  pageWidth: number;
  pageHeight: number;
  spreadIndex: number;
  spreadTotal: number;
  /** The pages, laid out by the caller across the two halves. */
  children: ReactNode;
};

/** The open book's frame: a shadow, and the edges of the page stacks showing on either side (more lines where more pages lie). */
export function Spread({ pageWidth, pageHeight, spreadIndex, spreadTotal, children }: Props) {
  const lines = edgeLines(spreadIndex, spreadTotal);
  const step = bookStyle.edgeLine + bookStyle.edgeGap;
  return (
    <View style={[{ width: pageWidth * 2, height: pageHeight }, styles.book]}>
      {children}
      {Array.from({ length: lines.left }, (_, i) => (
        <View key={`l${i}`} pointerEvents="none" style={[styles.edge, { left: -(i + 1) * step, height: pageHeight - (i + 1) * step * 2, top: (i + 1) * step, opacity: 1 - i * 0.12 }]} />
      ))}
      {Array.from({ length: lines.right }, (_, i) => (
        <View key={`r${i}`} pointerEvents="none" style={[styles.edge, { right: -(i + 1) * step, height: pageHeight - (i + 1) * step * 2, top: (i + 1) * step, opacity: 1 - i * 0.12 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  book: { ...shadows.page },
  edge: { position: "absolute", width: bookStyle.edgeLine, backgroundColor: colors.dimBrass },
});
