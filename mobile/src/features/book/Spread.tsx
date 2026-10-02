import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { bookStyle, colors, shadows } from "@/theme";
import { edgeLines } from "./edges";

type Props = {
  /** One page's width and height; the open book is two pages wide. */
  pageWidth: number;
  pageHeight: number;
  spreadIndex: number;
  spreadTotal: number;
  left: ReactNode;
  right: ReactNode;
};

/**
 * Two pages side by side with the fold between them shaded dark, and the edges of the page stacks showing on either side.
 * The edges are drawn outside the pages, so the wrapper is as wide as the pages plus the lines.
 */
export function Spread({ pageWidth, pageHeight, spreadIndex, spreadTotal, left, right }: Props) {
  const lines = edgeLines(spreadIndex, spreadTotal);
  const gutter = Math.round(pageWidth * bookStyle.gutterShare);
  const step = bookStyle.edgeLine + bookStyle.edgeGap;
  return (
    <View style={[{ width: pageWidth * 2, height: pageHeight }, styles.book]}>
      <View style={styles.row}>
        <View>{left}</View>
        <View>{right}</View>
      </View>
      <Gutter side="left" x={pageWidth - gutter} width={gutter} height={pageHeight} />
      <Gutter side="right" x={pageWidth} width={gutter} height={pageHeight} />
      {Array.from({ length: lines.left }, (_, i) => (
        <View key={`l${i}`} pointerEvents="none" style={[styles.edge, { left: -(i + 1) * step, height: pageHeight - (i + 1) * step * 2, top: (i + 1) * step, opacity: 1 - i * 0.12 }]} />
      ))}
      {Array.from({ length: lines.right }, (_, i) => (
        <View key={`r${i}`} pointerEvents="none" style={[styles.edge, { right: -(i + 1) * step, height: pageHeight - (i + 1) * step * 2, top: (i + 1) * step, opacity: 1 - i * 0.12 }]} />
      ))}
    </View>
  );
}

/** The fold: dark at the spine, clear toward the page. `side` is the page it sits on. */
function Gutter({ side, x, width, height }: { side: "left" | "right"; x: number; width: number; height: number }) {
  const toSpine = side === "left"; // on the left page the dark end is its right edge
  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: x, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id={`g-${side}`} x1={toSpine ? "0" : "1"} y1="0" x2={toSpine ? "1" : "0"} y2="0">
          <Stop offset="0" stopColor={colors.shadow} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.shadow} stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#g-${side})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  book: { ...shadows.page },
  row: { flexDirection: "row" },
  edge: { position: "absolute", width: bookStyle.edgeLine, backgroundColor: colors.dimBrass },
});
