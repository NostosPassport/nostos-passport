import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { devSimulator } from "@/features/location/dev-simulator";
import { useLocationState } from "@/features/location/location-store";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

/** "Simulated location" chip that clears the fake location. Renders nothing outside development. */
export function SimulatedLocationChip() {
  const { simulated } = useLocationState();
  if (!devSimulator || !simulated) return null;
  return (
    <Pressable
      onPress={devSimulator.clear}
      accessibilityRole="button"
      accessibilityLabel="Simulated location. Clear it."
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      hitSlop={space.xs}
      testID="sim-chip"
    >
      <Icon name="location.slash" color="warning" size={size.iconTiny} />
      <Text variant="footnote" weight="semibold">
        Simulated location
      </Text>
      <Icon name="xmark" color="textSecondary" size={size.iconTiny} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    minHeight: size.hitTarget - space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.surface },
});
