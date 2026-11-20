import type { NativeStackNavigationOptions } from "expo-router";
import type { ReactElement } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { nav } from "@/lib/nav";
import { colors, size, space } from "@/theme";
import { Icon } from "./icon";
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

/** Plain accent chevron used as the default back button in native headers. */
export function HeaderBackButton() {
  return (
    <Tappable onPress={() => nav.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={space.xs} style={styles.button}>
      <Icon name="chevron.left" color="accent" size={size.icon} />
    </Tappable>
  );
}

/**
 * Header options that place text buttons in the native header without the iOS 26 shared "glass" capsule, so
 * Cancel / Save read as plain editorial text on the cream bar (P-001). `left` replaces the back button.
 */
export function headerTextButtons({ left, right }: { left?: ReactElement; right?: ReactElement }): NativeStackNavigationOptions {
  return {
    ...(left ? { unstable_headerLeftItems: () => [{ type: "custom" as const, element: left, hidesSharedBackground: true }] } : {}),
    ...(right ? { unstable_headerRightItems: () => [{ type: "custom" as const, element: right, hidesSharedBackground: true }] } : {}),
  };
}

const styles = StyleSheet.create({ button: { minHeight: size.hitTarget, minWidth: size.hitTarget, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxs } });
