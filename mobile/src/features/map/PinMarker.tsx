import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { type CategoryStampArtwork, CUISINE_PATHS } from "../../../../shared/category-stamp-artwork";

import { StampMark } from "@/features/book/StampMark";
import type { StampInput } from "@/features/book/stamp-design";
import { colors, radius, shadows, size } from "@/theme";
import type { PinKind } from "./map-model";

const LIT = size.marker;
const DIM = size.vibeDot;

/**
 * A pin on the map. Lit (you've stamped the place): a little brass stamp of that place in a glowing ring. Dim: a small dot.
 * Selected pins are drawn larger by the screen (it passes `selected`); a key change redraws the snapshot the map keeps.
 */
export function PinMarker({ kind, selected, input, artwork }: { kind: PinKind; selected: boolean; input: StampInput; artwork?: CategoryStampArtwork | null }) {
  if (kind === "dim") {
    return <View style={[styles.dim, selected && styles.dimSelected]} />;
  }
  const box = selected ? Math.round(LIT * 1.25) : LIT;
  const iconSize = box - size.markerRing * 5;
  return (
    <View style={[styles.lit, shadows.glow, { width: box, height: box, borderRadius: box / 2, ...(artwork ? { borderColor: artwork.color } : {}) }]}>
      {artwork ? (
        <Svg width={iconSize} height={iconSize} viewBox="-1 -1 26 26" preserveAspectRatio="xMidYMid meet">
          <Path d={CUISINE_PATHS[artwork.icon]} fill="none" stroke={artwork.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : <StampMark input={input} size={box - size.markerRing * 2} />}
    </View>
  );
}

const styles = StyleSheet.create({
  lit: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: size.markerRing, borderColor: colors.brass },
  dim: { width: DIM, height: DIM, borderRadius: radius.pill, backgroundColor: colors.dimBrass, opacity: 0.8 },
  dimSelected: { width: DIM * 2, height: DIM * 2, backgroundColor: colors.brass, opacity: 1 },
});
