import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { StampView } from "@/api/contracts";
import { Text } from "@/components/ui/text";
import { localityKey, localityLabel } from "@/lib/place";
import { bookStyle, colors } from "@/theme";
import { rosettePath, wavePaths } from "./guilloche";
import { PageStock } from "./PageStock";
import { StampMark } from "./StampMark";
import { applyLayout, type StampLayout } from "@/features/books/arrange";
import { ArrangeableStamp } from "@/features/books/ArrangeableStamp";
import { type Placement, placementHeight, stampPlacement } from "./slots";

export type RenderStamp = (stamp: StampView, placement: Placement) => ReactNode;
/** Lets the owner move, resize, tilt and take out stamps on this page. Without it the page is read-only. */
export type PageArrange = { layouts: ReadonlyMap<string, StampLayout>; onPlace: (stamp: StampView, layout: StampLayout) => void; onTakeOut: (stamp: StampView) => void };
type Props = { page: number; side: "left" | "right"; width: number; height: number; stamps: readonly StampView[]; renderStamp?: RenderStamp; onStampPress?: (stamp: StampView) => void; arrange?: PageArrange };
const defaultRender: RenderStamp = (stamp, p) => <StampMark input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: localityLabel(stamp.place) }} size={p.size} artwork={stamp.artwork} photoUrl={stamp.photoUrl} visitedAt={stamp.visitedAt} timeZone={stamp.place.timeZone} />;

function visitDate(stamp: StampView): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone }).format(new Date(stamp.visitedAt));
}

export function PageView({ page, side, width, height, stamps, renderStamp = defaultRender, onStampPress, arrange }: Props) {
  const band = Math.round(height * 0.05);
  const inset = Math.round(width * 0.06);
  return (
    <PageStock width={width} height={height} spine={side === "left" ? "right" : "left"}>
      <Svg width={width} height={height} style={styles.fill} pointerEvents="none">
        <Path d={rosettePath(`page:${page}`, width / 2, height / 2, width * 0.42)} stroke={colors.brass} strokeOpacity={0.07} strokeWidth={bookStyle.pageLine} fill="none" />
        {wavePaths(`top:${page}`, width - inset * 2, band).map((d, i) => <Path key={`t${i}`} d={d} transform={`translate(${inset} ${inset})`} stroke={colors.brass} strokeOpacity={0.14} strokeWidth={bookStyle.pageLine} fill="none" />)}
      </Svg>
      {stamps.map((stamp) => {
        const auto = stampPlacement(stamp, width, height);
        const p = applyLayout(auto, arrange?.layouts.get(stamp.id), width, height);
        const label = `Stamp, ${stamp.place.name}, ${visitDate(stamp)}, page ${page}${stamp.verified ? ", visit verified" : ""}`;
        // Keyed by the saved spot, so a stamp starts fresh from where it now sits after each save.
        if (arrange) {
          return (
            <ArrangeableStamp key={`${stamp.id}:${p.cx}:${p.cy}:${p.size}:${p.rotation}`} auto={auto} placed={p} pageWidth={width} pageHeight={height} label={label} onPress={onStampPress ? () => onStampPress(stamp) : undefined} onPlace={(l) => arrange.onPlace(stamp, l)} onTakeOut={() => arrange.onTakeOut(stamp)}>
              {renderStamp(stamp, p)}
            </ArrangeableStamp>
          );
        }
        return (
          <Pressable key={stamp.id} onPress={onStampPress ? () => onStampPress(stamp) : undefined} accessibilityRole="button" accessibilityLabel={label} style={{ position: "absolute", left: p.cx - p.size / 2, top: p.cy - placementHeight(p) / 2, width: p.size, height: placementHeight(p), transform: [{ rotate: `${p.rotation}deg` }] }}>
            {renderStamp(stamp, p)}
          </Pressable>
        );
      })}
      <Text variant="typewriterSmall" color="dimBrass" tabular maxFontSizeMultiplier={1.15} style={[styles.number, { bottom: inset, [side === "left" ? "left" : "right"]: inset * 1.4 }]} accessibilityLabel={`Page ${page}`}>{page}</Text>
    </PageStock>
  );
}

const styles = StyleSheet.create({ fill: { position: "absolute", top: 0, left: 0 }, number: { position: "absolute" } });
