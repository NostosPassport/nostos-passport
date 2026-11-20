/**
 * Dresses the one-page reader as an open book: the cover board shows around the page, a spine shadow runs down the
 * left, the stacked edges of the pages still ahead show on the right, and a page counter sits underneath.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { bookStyle, colors, radius, scene3d, shadows, space } from "@/theme";

/** Board showing beyond the page on the top, bottom and fore-edge. */
export const FRAME_BOARD = 7;
/** Board width on the spine side, wider so it reads as the hinge. */
export const FRAME_SPINE = 14;
const EDGE_STEP = bookStyle.edgeLine + bookStyle.edgeGap;
/** Height reserved under the book for the page counter. */
export const FRAME_COUNTER = 30;

/** Extra room the frame needs around a page, for sizing the page to fit the screen. */
export const FRAME_EXTRA = {
  width: FRAME_SPINE + FRAME_BOARD + bookStyle.maxEdgeLines * EDGE_STEP,
  height: FRAME_BOARD * 2 + FRAME_COUNTER,
};

type Props = {
  pageWidth: number;
  pageHeight: number;
  page: number;
  total: number;
  coverColor?: string;
  children: ReactNode;
};

export function BookFrame({ pageWidth, pageHeight, page, total, coverColor = scene3d.passportCover, children }: Props) {
  const ahead = Math.min(bookStyle.maxEdgeLines, Math.max(0, total - 1 - page));
  const right = FRAME_BOARD + ahead * EDGE_STEP;
  const board = darken(coverColor, 0.38);
  return (
    <View style={styles.wrap}>
      <View style={[styles.board, { backgroundColor: board, paddingTop: FRAME_BOARD, paddingBottom: FRAME_BOARD, paddingLeft: FRAME_SPINE, paddingRight: right }]}>
        {Array.from({ length: ahead }, (_, i) => ahead - i).map((n) => (
          <View
            key={n}
            pointerEvents="none"
            style={[styles.edge, { left: FRAME_SPINE + n * EDGE_STEP, top: FRAME_BOARD + n * 0.5, width: pageWidth, height: pageHeight - n }]}
          />
        ))}
        <View style={{ width: pageWidth, height: pageHeight }}>{children}</View>
        <Svg pointerEvents="none" width={FRAME_SPINE + 18} height={pageHeight + FRAME_BOARD * 2} style={styles.spine}>
          <Defs>
            <LinearGradient id="book-spine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0.34} />
              <Stop offset={String(FRAME_SPINE / (FRAME_SPINE + 18))} stopColor={colors.textPrimary} stopOpacity={0.16} />
              <Stop offset="1" stopColor={colors.textPrimary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={FRAME_SPINE + 18} height={pageHeight + FRAME_BOARD * 2} fill="url(#book-spine)" />
        </Svg>
      </View>
      <Text variant="typewriterSmall" color="dimBrass" tabular style={styles.counter} accessibilityElementsHidden importantForAccessibility="no">
        {page === 0 ? "BEARER" : `${page} / ${total - 1}`}
      </Text>
    </View>
  );
}

/** The cover under studio light reads much darker than its flat colour; match the 3D model rather than the swatch. */
function darken(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  return `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  board: { borderRadius: radius.chip / 2, ...shadows.book },
  edge: { position: "absolute", backgroundColor: colors.paper, borderWidth: bookStyle.edgeLine / 2, borderColor: colors.hairline },
  spine: { position: "absolute", left: 0, top: 0 },
  counter: { height: FRAME_COUNTER, paddingTop: space.sm },
});
