import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors, radius, size, space, timing, type as typeScale } from "@/theme";

type Props = { width?: DimensionValue; height?: number; round?: boolean };

/** A placeholder block that gently pulses (static under Reduce Motion). */
export function Skeleton({ width = "100%", height = typeScale.body.lineHeight, round }: Props) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    o.value = withRepeat(withTiming(0.5, { duration: timing.skeletonPulse }), -1, true);
    return () => cancelAnimation(o);
  }, [o, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.block, { width, height, borderRadius: round ? height / 2 : radius.chip }, style]} />;
}

/** Skeleton for a list of rows. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={size.vibeDot} height={size.vibeDot} round />
          <View style={styles.lines}>
            <Skeleton width="55%" height={typeScale.headline.fontSize} />
            <Skeleton width="80%" height={typeScale.footnote.fontSize} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.elevated },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.listRow },
  lines: { flex: 1, gap: space.xs },
});
