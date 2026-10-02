import { Pressable, StyleSheet } from "react-native";

import { size, space } from "@/theme";
import { Text } from "./text";

/** Text button for native headers ("Cancel", "Save"). */
export function HeaderButton({ label, onPress, bold, disabled }: { label: string; onPress: () => void; bold?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={space.xs} style={styles.button}>
      <Text variant="body" color={disabled ? "textTertiary" : "accent"} weight={bold ? "semibold" : "regular"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ button: { minHeight: size.hitTarget, justifyContent: "center", paddingHorizontal: space.xxs } });
