import { StyleSheet, View } from "react-native";

import type { VibeState } from "@/api/contracts";
import { colors, noDataOutline, size, vibeColors } from "@/theme";

/** Small vibe indicator. Always paired with the vibe word nearby; color is never the only signal. */
export function VibeDot({ vibe, dotSize = size.vibeDot }: { vibe: VibeState; dotSize?: number }) {
  const hollow = vibe === "NO_DATA";
  return (
    <View
      accessible={false}
      style={[
        styles.dot,
        { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
        hollow ? styles.hollow : { backgroundColor: vibeColors[vibe] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { backgroundColor: colors.transparent },
  hollow: { borderWidth: size.borderEmphasis, borderColor: noDataOutline },
});
