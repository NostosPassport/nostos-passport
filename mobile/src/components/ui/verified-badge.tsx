import { StyleSheet, View } from "react-native";

import { colors, size as sizes, verifiedDiamondScale } from "@/theme";
import { Icon } from "./icon";

/**
 * The verified badge: a small champagne diamond with a check. Shown next to a handle, only where the viewer may see
 * that handle (never on "Anonymous"). Spoken as "Verified" when it stands alone; rows that carry their own label
 * pass `accessible={false}` and say "verified" in that label instead.
 */
export function VerifiedBadge({ accessible = true }: { accessible?: boolean }) {
  return (
    <View
      style={styles.box}
      accessible={accessible}
      accessibilityRole={accessible ? "image" : undefined}
      accessibilityLabel={accessible ? "Verified" : undefined}
      importantForAccessibility={accessible ? "yes" : "no-hide-descendants"}
    >
      <View style={styles.diamond} />
      <Icon name="checkmark" color="onVerified" size={sizes.verifiedCheck} weight="black" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: sizes.verifiedBadge, height: sizes.verifiedBadge, alignItems: "center", justifyContent: "center" },
  diamond: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.verified,
    borderRadius: sizes.verifiedCorner,
    transform: [{ rotate: "45deg" }, { scale: verifiedDiamondScale }],
  },
});
