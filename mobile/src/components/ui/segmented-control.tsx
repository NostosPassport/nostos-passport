import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { colors, radius, size, space, spring } from "@/theme";
import { Text } from "./text";

type Segment<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
};

/** iOS-style segmented control with a sliding selection. */
export function SegmentedControl<K extends string>({ segments, value, onChange, accessibilityLabel }: Props<K>) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const x = useSharedValue(0);
  const segWidth = width / segments.length;

  useEffect(() => {
    x.value = reduceMotion ? index * segWidth : withSpring(index * segWidth, spring.snappy);
  }, [index, segWidth, reduceMotion, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - space.xxs * 2)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 && <Animated.View style={[styles.thumb, { width: segWidth }, thumb]} />}
      {segments.map((s) => {
        const selected = s.key === value;
        return (
          <Pressable
            key={s.key}
            style={styles.segment}
            hitSlop={{ top: space.xxs, bottom: space.xxs }}
            accessibilityRole="tab"
            accessibilityLabel={s.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(s.key);
            }}
          >
            <Text
              variant="footnote"
              weight={selected ? "semibold" : "medium"}
              color={selected ? "textPrimary" : "textSecondary"}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: space.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.background,
  },
  thumb: {
    position: "absolute",
    top: space.xxs,
    bottom: space.xxs,
    left: space.xxs,
    borderRadius: radius.chip - space.xxs,
    backgroundColor: colors.elevated,
  },
  segment: { flex: 1, minHeight: size.hitTarget - space.xs, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxs },
});
