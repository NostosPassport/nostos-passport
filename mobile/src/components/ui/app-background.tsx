import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

const GRADIENT_ID = "nostos-app-background";

export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.background} />
            <Stop offset="100%" stopColor={colors.surface} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRADIENT_ID})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });
