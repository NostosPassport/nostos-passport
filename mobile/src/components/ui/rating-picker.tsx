import { Pressable, StyleSheet, View } from "react-native";

import { haptics } from "@/lib/haptics";
import { colors, dimmedOpacity, radius, size, space } from "@/theme";
import { Text } from "./text";

export const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Spoken value: "8 out of 10" or "Not rated". */
export function ratingValueText(value: number | null): string {
  return value === null ? "Not rated" : `${value} out of 10`;
}

/** VoiceOver swipe up / down: step the rating by one, starting from 5 when nothing is picked yet. */
export function stepRating(value: number | null, direction: "increment" | "decrement"): number {
  if (value === null) return 5;
  return Math.min(10, Math.max(1, value + (direction === "increment" ? 1 : -1)));
}

/**
 * A 1-10 rating: one row of tappable numbers with a light haptic on each pick. For VoiceOver it's a single
 * adjustable control ("Rating, 8 out of 10": swipe up or down), so nobody has to find ten small targets.
 */
export function RatingPicker({ value, onChange, disabled }: { value: number | null; onChange: (rating: number) => void; disabled?: boolean }) {
  const pick = (n: number) => {
    if (disabled || n === value) return;
    haptics.select();
    onChange(n);
  };
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Rating"
      accessibilityValue={{ min: 1, max: 10, now: value ?? undefined, text: ratingValueText(value) }}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === "increment" || name === "decrement") pick(stepRating(value, name));
      }}
    >
      {RATINGS.map((n) => {
        const selected = n === value;
        return (
          <Pressable
            key={n}
            testID={`rating-${n}`}
            onPress={() => pick(n)}
            disabled={disabled}
            hitSlop={{ top: space.xs, bottom: space.xs }}
            importantForAccessibility="no"
            style={({ pressed }) => [styles.cell, selected && styles.selected, pressed && !selected && styles.pressed, disabled && styles.disabled]}
          >
            <Text variant="headline" tabular color={selected ? "onAccent" : "textPrimary"} maxFontSizeMultiplier={1.2}>
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.xxs },
  cell: {
    flex: 1,
    minHeight: size.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.chip,
    backgroundColor: colors.elevated,
  },
  selected: { backgroundColor: colors.accent },
  pressed: { backgroundColor: colors.surface },
  disabled: { opacity: dimmedOpacity },
});
