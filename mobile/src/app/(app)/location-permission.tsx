import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { locationStore, useLocationState } from "@/features/location/location-store";
import { colors, fonts, screenPadding, space } from "@/theme";

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
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          {denied ? "Location is off" : "Verify where you've been"}
        </Text>
        <Text color="textSecondary">
          {denied
            ? "You can still use Nostos and make stamps without location. Turn it on in Settings when you want nearby places and location-verified Now stamps."
            : "Location is optional. Nostos can use it while you're in the app to show nearby places and verify a Now stamp when you're at the venue. Without it, your stamps still work and are simply unverified."}
        </Text>
      </View>
      <View style={styles.actions}>
        {denied ? (
          <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Use my location" onPress={() => void ask()} loading={asking} />
        )}
        <Button title="Continue without location" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding, justifyContent: "space-between" },
  body: { gap: space.md, paddingTop: space.xl },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 48, lineHeight: 50, letterSpacing: -1.1 },
  actions: { gap: space.sm },
});
