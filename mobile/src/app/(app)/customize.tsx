import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";
import { nav } from "@/lib/nav";

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
      <Button title="Close" variant="secondary" block={false} onPress={() => nav.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.surface, alignItems: "center", gap: space.sm, paddingHorizontal: screenPadding, paddingTop: space.xl, paddingBottom: space.xxl },
});
