import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { bookStyle, colors, radius, space } from "@/theme";
import { FIRST_RUN_COPY } from "./first-run";

/** A quiet card under the closed passport, shown once. */
export function FirstRunHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.card} accessible={false}>
      <Text variant="serifLabel" color="brass" accessibilityRole="header">
        {FIRST_RUN_COPY.title}
      </Text>
      <Text variant="typewriterSmall" color="textSecondary">
        {FIRST_RUN_COPY.body}
      </Text>
      <Button title={FIRST_RUN_COPY.button} variant="plain" compact block={false} onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "stretch", marginHorizontal: space.lg, gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: bookStyle.pageLine, borderColor: colors.dimBrass },
});
