import { StyleSheet, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import type { CategoryStampArtwork } from "../../../../shared/category-stamp-artwork";
import { buildStampScene, designFromArtwork } from "../../../../shared/category-stamp-design";

import { StampMark } from "@/features/book/StampMark";
import type { StampInput } from "@/features/book/stamp-design";
import { colors, radius, shadows, size } from "@/theme";
import type { PinKind } from "./map-model";

const LIT = size.marker;
const DIM = size.vibeDot;

export function PinMarker({ kind, selected, input, artwork }: { kind: PinKind; selected: boolean; input: StampInput; artwork?: CategoryStampArtwork | null }) {
  if (kind === "dim") {
    return <View style={[styles.dim, selected && styles.dimSelected]} />;
  }

  const box = selected ? Math.round(LIT * 1.25) : LIT;
  const iconSize = box - size.markerRing * 5;

  if (!artwork) {
    return (
      <View style={[styles.lit, shadows.glow, { width: box, height: box, borderRadius: box / 2 }]}>
        <StampMark input={input} size={box - size.markerRing * 2} />
      </View>
    );
  }

  const design = designFromArtwork(artwork, { name: input.placeName, locality: input.localityName, timeZone: "UTC", priceTier: null });
  const icon = buildStampScene(design, { seed: input.placeId, dateLabel: "" }).icon;
  const rotation = icon.rotate ? `rotate(${icon.rotate} 12 12)` : undefined;

  return (
    <View style={[styles.lit, shadows.glow, { width: box, height: box, borderRadius: box / 2, borderColor: design.color }]}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" pointerEvents="none">
        <G
          transform={rotation}
          fill={icon.fill ? design.color : "none"}
          stroke={design.color}
          strokeWidth={icon.fill ? 0.6 : icon.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d={icon.d} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  lit: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: size.markerRing, borderColor: colors.brass },
  dim: { width: DIM, height: DIM, borderRadius: radius.pill, backgroundColor: colors.dimBrass, opacity: 0.8 },
  dimSelected: { width: DIM * 2, height: DIM * 2, backgroundColor: colors.brass, opacity: 1 },
});
