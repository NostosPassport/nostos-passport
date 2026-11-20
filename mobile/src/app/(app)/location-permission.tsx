import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { locationStore, useLocationState } from "@/features/location/location-store";
import { colors, fonts, screenPadding, space } from "@/theme";
import { nav } from "@/lib/nav";

export default function LocationPermission() {
  const insets = useSafeAreaInsets();
  const { permission } = useLocationState();
  const [asking, setAsking] = useState(false);
  const denied = permission === "denied";

  const ask = async () => {
    setAsking(true);
    const result = await locationStore.request().finally(() => setAsking(false));
    if (result === "granted") nav.back();
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + space.md }]}>
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
        <Button title="Continue without location" variant="secondary" onPress={() => nav.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: screenPadding, paddingTop: space.xl, gap: space.xl },
  body: { gap: space.md },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 40, lineHeight: 44, letterSpacing: -0.9 },
  actions: { gap: space.sm },
});
