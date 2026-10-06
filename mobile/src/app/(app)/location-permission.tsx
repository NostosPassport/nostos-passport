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
          {denied ? "Location is off" : "Find your way"}
        </Text>
        <Text color="textSecondary">
          {denied
            ? "Nostos can't see your location. Turn it on in Settings to find nearby places and confirm you're there when you stamp one."
            : "Nostos uses location while you're using the app to find nearby places and confirm you're there when you stamp one. Your position isn't shown to anyone."}
        </Text>
      </View>
      <View style={styles.actions}>
        {denied ? (
          <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Continue" onPress={() => void ask()} loading={asking} />
        )}
        <Button title="Not now" variant="secondary" onPress={() => router.back()} />
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
