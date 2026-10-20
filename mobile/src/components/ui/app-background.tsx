import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

export function AppBackground({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });
