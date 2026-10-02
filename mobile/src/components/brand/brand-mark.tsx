import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { size, space } from "@/theme";
import { EmblemMark } from "./emblem-mark";

/** The mark: the emblem and the name in tracked serif capitals. */
export function BrandMark() {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Nostos">
      <EmblemMark size={size.iconLarge} />
      <Text variant="serifLabel" color="brass" accessibilityElementsHidden>
        NOSTOS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: space.xs } });
