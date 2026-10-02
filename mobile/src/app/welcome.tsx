import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { farewellNotice, useAuth } from "@/auth/auth-context";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAnnounce } from "@/lib/a11y";
import { HOME_REGION } from "@/lib/geo";
import { colors, radius, screenPadding, size, space } from "@/theme";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { browseAsGuest } = useAuth();
  const [panelHeight, setPanelHeight] = useState(0);
  // Shown once after deleting an account.
  const [farewell] = useState(() => farewellNotice.take());
  useAnnounce(farewell);

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={HOME_REGION}
        userInterfaceStyle="dark"
        showsPointsOfInterests={false}
        showsCompass={false}
        pitchEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        // Keep Apple's logo and Legal link visible above the panel.
        legalLabelInsets={{ top: 0, left: space.md, right: 0, bottom: panelHeight + space.xs }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <BrandMark />
      </View>
      <View style={[styles.panel, { paddingBottom: insets.bottom + space.sm }]} onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}>
        {farewell && (
          <View style={styles.farewell}>
            <Icon name="checkmark.circle.fill" color="success" size={size.iconSmall} />
            <Text variant="subhead" weight="semibold">
              {farewell}
            </Text>
          </View>
        )}
        <Text variant="largeTitle" accessibilityRole="header">
          Know before you go.
        </Text>
        <Text variant="body" color="textSecondary">
          Live vibe, line and cover at East Village and Lower East Side bars, from people who are there right now.
        </Text>
        <View style={styles.actions}>
          <Button title="Create account" onPress={() => router.push("/sign-up")} />
          <Button title="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
          <Button title="Look around first" variant="plain" onPress={browseAsGuest} accessibilityHint="Browse the map without an account" />
        </View>
        <Text variant="footnote" color="textTertiary">
          For adults 21 and over.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: screenPadding },
  panel: {
    marginTop: "auto",
    gap: space.sm,
    paddingTop: space.xl,
    paddingHorizontal: screenPadding,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  actions: { gap: space.xs, marginTop: space.sm },
  farewell: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
