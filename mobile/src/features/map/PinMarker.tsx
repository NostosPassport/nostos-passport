import { StyleSheet, View } from "react-native";

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
export function PinMarker({ kind, selected, input }: { kind: PinKind; selected: boolean; input: StampInput }) {
  if (kind === "dim") {
    return <View style={[styles.dim, selected && styles.dimSelected]} />;
  }
  const box = selected ? Math.round(LIT * 1.25) : LIT;
  return (
    <View style={[styles.lit, shadows.glow, { width: box, height: box, borderRadius: box / 2 }]}>
      <StampMark input={input} size={box - size.markerRing * 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  lit: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: size.markerRing, borderColor: colors.brass },
  dim: { width: DIM, height: DIM, borderRadius: radius.pill, backgroundColor: colors.dimBrass, opacity: 0.8 },
  dimSelected: { width: DIM * 2, height: DIM * 2, backgroundColor: colors.brass, opacity: 1 },
});
