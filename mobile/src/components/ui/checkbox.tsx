import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, pressedOpacity, radius, size, space } from "@/theme";
import { Icon } from "./icon";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
  invalid?: boolean;
  children: ReactNode;
};

/** The whole row toggles. Keep links out of `children`; put them in their own buttons. */
export function Checkbox({ checked, onChange, accessibilityLabel, invalid, children }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => {
        haptics.select();
        onChange(!checked);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, invalid && !checked && styles.invalid, checked && styles.checked]}>
        {checked && <Icon name="checkmark" color="onAccent" size={size.iconTiny} weight="bold" />}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget, borderRadius: radius.chip },
  pressed: { opacity: pressedOpacity },
  box: {
    width: size.checkbox,
    height: size.checkbox,
    borderRadius: radius.pill,
    borderWidth: size.borderEmphasis,
    borderColor: colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  invalid: { borderColor: colors.danger },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { flex: 1 },
});
