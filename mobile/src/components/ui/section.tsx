import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/theme";
import { Text } from "./text";

/** A titled block on a screen. No card chrome: spacing does the grouping. */
export function Section({ title, accessory, children }: { title: string; accessory?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="title2" accessibilityRole="header">
          {title}
        </Text>
        {accessory}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
});
