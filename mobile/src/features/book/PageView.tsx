import type { ReactNode } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { StampView } from "@/api/contracts";
import { Text } from "@/components/ui/text";
import { localityKey, localityLabel } from "@/lib/place";
import { bookStyle, colors } from "@/theme";
import { ribbonPath, ribbonsOnPage } from "./edges";
import { rosettePath, wavePaths } from "./guilloche";
import { PageStock } from "./PageStock";
import { StampMark } from "./StampMark";
import { type Placement, slotPlacement } from "./slots";

const NOSTOS_MARK = require("../../../assets/images/nostos-watermark.png");
export type RenderStamp = (stamp: StampView, placement: Placement) => ReactNode;
type Props = { page: number; side: "left" | "right"; width: number; height: number; stamps: readonly StampView[]; pinnedIds?: readonly string[]; renderStamp?: RenderStamp; onStampPress?: (stamp: StampView) => void };
const defaultRender: RenderStamp = (stamp, p) => <StampMark input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: localityLabel(stamp.place) }} size={p.size} />;

export function PageView({ page, side, width, height, stamps, pinnedIds = [], renderStamp = defaultRender, onStampPress }: Props) {
  const ribbons = new Set(ribbonsOnPage(stamps, pinnedIds));
  const band = Math.round(height * 0.05);
  const inset = Math.round(width * 0.06);
  const ribbonW = Math.round(width * 0.05);
  return (
    <PageStock width={width} height={height} spine={side === "left" ? "right" : "left"}>
      <Svg width={width} height={height} style={styles.fill} pointerEvents="none">
        <Path d={rosettePath(`page:${page}`, width / 2, height / 2, width * 0.42)} stroke={colors.brass} strokeOpacity={0.07} strokeWidth={bookStyle.pageLine} fill="none" />
        {wavePaths(`top:${page}`, width - inset * 2, band).map((d, i) => <Path key={`t${i}`} d={d} transform={`translate(${inset} ${inset})`} stroke={colors.brass} strokeOpacity={0.14} strokeWidth={bookStyle.pageLine} fill="none" />)}
      </Svg>
      {stamps.map((stamp) => {
        const p = slotPlacement(stamp.id, stamp.slot ?? 1, width, height);
        const mark = Math.max(13, p.size * 0.16);
        return (
          <Pressable key={stamp.id} onPress={onStampPress ? () => onStampPress(stamp) : undefined} accessibilityRole="button" accessibilityLabel={`Stamp, ${stamp.place.name}, page ${page}, slot ${stamp.slot}${stamp.verified ? ", visit verified" : ""}${ribbons.has(stamp.id) ? ", pinned" : ""}`} style={{ position: "absolute", left: p.cx - p.size / 2, top: p.cy - p.size / 2, width: p.size, height: p.size, transform: [{ rotate: `${p.rotation}deg` }] }}>
            {renderStamp(stamp, p)}
            {stamp.verified ? <Image source={NOSTOS_MARK} style={{ position: "absolute", right: p.size * 0.03, bottom: p.size * 0.03, width: mark, height: mark, opacity: 0.9 }} contentFit="contain" accessible={false} /> : null}
            {ribbons.has(stamp.id) ? <Svg width={ribbonW} height={ribbonW * 2.6} style={{ position: "absolute", top: -ribbonW * 0.4, right: p.size * 0.08 }} pointerEvents="none"><Path d={ribbonPath(ribbonW, ribbonW * 2.6)} fill={colors.brass} fillOpacity={0.9} /></Svg> : null}
          </Pressable>
        );
      })}
      <Text variant="typewriterSmall" color="dimBrass" tabular style={[styles.number, { bottom: inset, [side === "left" ? "left" : "right"]: inset * 1.4 }]} accessibilityLabel={`Page ${page}`}>{page}</Text>
    </PageStock>
  );
}

const styles = StyleSheet.create({ fill: { position: "absolute", top: 0, left: 0 }, number: { position: "absolute" } });
