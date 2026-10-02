import { StyleSheet, View } from "react-native";

import { colors, hairlineWidth, radius, space } from "@/theme";
import { Text } from "./text";

/** Small neutral label ("Hidden", "Suspended"). Never the accent. */
export function Badge({ label, onMedia }: { label: string; onMedia?: boolean }) {
  return (
    <View style={[styles.badge, onMedia && styles.onMedia]}>
      <Text variant="caption" weight="semibold" color={onMedia ? "textPrimary" : "textSecondary"} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.chip,
    borderWidth: hairlineWidth,
    borderColor: colors.textTertiary,
  },
  onMedia: { backgroundColor: colors.scrim, borderColor: colors.transparent },
});
