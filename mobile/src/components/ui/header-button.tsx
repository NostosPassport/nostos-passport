import { ActivityIndicator, StyleSheet } from "react-native";

import { colors, size, space } from "@/theme";
import { Tappable } from "./tappable";
import { Text } from "./text";

/** Text button for native headers ("Cancel", "Save"). `loading` swaps the label for a spinner while a save runs. */
export function HeaderButton({ label, onPress, bold, disabled, loading }: { label: string; onPress: () => void; bold?: boolean; disabled?: boolean; loading?: boolean }) {
  const inactive = disabled || loading;
  return (
    <Tappable onPress={onPress} disabled={inactive} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!inactive, busy: !!loading }} hitSlop={space.xs} style={styles.button}>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text variant="body" color={disabled ? "textTertiary" : "accent"} weight={bold ? "semibold" : "regular"}>
          {label}
        </Text>
      )}
    </Tappable>
  );
}

const styles = StyleSheet.create({ button: { minHeight: size.hitTarget, minWidth: size.hitTarget, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxs } });
