import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";

/** A quiet teaser. Nothing here can be bought or changed yet. */
export default function Customize() {
  return (
    <View style={styles.root}>
      <Icon name="lock.fill" color="brass" size={size.iconLarge} />
      <Text variant="title2" accessibilityRole="header">
        Customize
      </Text>
      <Text variant="callout" color="textSecondary" align="center">
        Cover leather, page stock and stamp inks are on the way. Nothing to set up yet, and nothing to buy.
      </Text>
      <Button title="Close" variant="secondary" block={false} onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: screenPadding },
});
