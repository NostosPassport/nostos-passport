import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";
import { nav } from "@/lib/nav";

/** A quiet teaser. Nothing here can be bought or changed yet. */
export default function Customize() {
  const insets = useSafeAreaInsets();
  return (
    // Bottom padding clears the home indicator the same way the location sheet does.
    <View style={[styles.root, { paddingBottom: insets.bottom + space.md }]}>
      <Icon name="lock.fill" color="brass" size={size.iconLarge} />
      <Text variant="title2" accessibilityRole="header">
        Customize
      </Text>
      <Text variant="callout" color="textSecondary" align="center">
        Cover leather, page stock and stamp inks are on the way. Nothing to set up yet, and nothing to buy.
      </Text>
      {/* Full width under the centred copy, like the sheet's other actions; not a small box pinned left (P-148). */}
      <View style={styles.action}>
        <Button title="Close" variant="secondary" onPress={() => nav.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.surface, alignItems: "center", gap: space.sm, paddingHorizontal: screenPadding, paddingTop: space.xl },
  action: { alignSelf: "stretch", paddingTop: space.sm },
});
