import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, size, space } from "@/theme";

/** The mark: a single glowing dot, the same one as the app icon. */
export function BrandMark() {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Nostos">
      <View style={styles.glow}>
        <View style={styles.dot} />
      </View>
      <Text variant="headline" weight="bold">
        Nostos
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  glow: {
    width: size.icon,
    height: size.icon,
    borderRadius: size.icon / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: space.xs,
    shadowOffset: { width: 0, height: 0 },
  },
  dot: { width: size.vibeDot + space.xxs, height: size.vibeDot + space.xxs, borderRadius: size.vibeDot, backgroundColor: colors.accent },
});
