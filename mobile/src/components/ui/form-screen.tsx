import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { colors, screenPadding, space } from "@/theme";

/** Scrollable form under a large-title header; iOS keeps the focused field above the keyboard. */
export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.xs, gap: space.xl, paddingBottom: space.xxxl },
});
