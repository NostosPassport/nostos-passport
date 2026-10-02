import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, dimmedOpacity, hairlineWidth, radius, size, space } from "@/theme";
import { Text } from "./text";

type Props = {
  label: string;
  leading?: ReactNode;
  selected?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  large?: boolean;
};

/** One-tap choice. Selection uses the accent outline; the label always carries the meaning. */
export function Chip({ label, leading, selected, loading, disabled, onPress, accessibilityLabel, large }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.chip,
        large && styles.large,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && !loading && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={colors.textSecondary} /> : leading}
        <Text variant={large ? "headline" : "subhead"} weight="semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.hitTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    backgroundColor: colors.elevated,
    borderWidth: size.borderEmphasis,
    borderColor: colors.transparent,
    justifyContent: "center",
  },
  large: { minHeight: size.buttonHeight + space.sm, flexGrow: 1, flexBasis: "45%" },
  selected: { borderColor: colors.accent },
  pressed: { backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: hairlineWidth },
  disabled: { opacity: dimmedOpacity },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
