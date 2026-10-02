import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { locationStore, useLocationState } from "@/features/location/location-store";
import { colors, radius, screenPadding, size, space } from "@/theme";

/** Pre-permission screen: one line on why, then the system prompt. Denied gets a path to Settings. */
export default function LocationPermission() {
  const insets = useSafeAreaInsets();
  const { permission } = useLocationState();
  const [asking, setAsking] = useState(false);
  const denied = permission === "denied";

  const ask = async () => {
    setAsking(true);
    const result = await locationStore.request().finally(() => setAsking(false));
    if (result === "granted") router.back();
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="location.fill" color="accent" size={size.iconLarge} />
        </View>
        <Text variant="title2" accessibilityRole="header">
          {denied ? "Location is off" : "See what's near you"}
        </Text>
        <Text color="textSecondary">
          {denied
            ? "Nostos can't see your location. Turn it on in Settings to sort by distance and post from a venue."
            : "Nostos uses your location while you're using the app to sort bars by distance and to confirm you're at a venue when you post."}
        </Text>
      </View>
      <View style={styles.actions}>
        {denied ? (
          <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Continue" onPress={() => void ask()} loading={asking} />
        )}
        <Button title="Not now" variant="plain" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: screenPadding, paddingTop: space.xxxl, justifyContent: "space-between" },
  body: { gap: space.sm },
  badge: {
    width: size.avatarLarge,
    height: size.avatarLarge,
    borderRadius: radius.largeCard,
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  actions: { gap: space.xs },
});
