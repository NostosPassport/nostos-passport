import { router, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Icon } from "@/components/ui/icon";
import { SOCIAL_ENABLED } from "@/config";
import { colors, shadows, size, space } from "@/theme";

/**
 * Passport (home), Stamp (the large center button) and Map. With the social layer off there is nothing else: no feed, no
 * bell. (With SOCIAL_ENABLED on, Feed and Activity come back as extra tabs.)
 */
export default function TabsLayout() {
  const { status } = useAuth();
  const social = SOCIAL_ENABLED ? undefined : null;
  return (
    <Tabs
      initialRouteName="passport"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.hairline, height: size.hitTarget + space.xl },
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.dimBrass,
      }}
    >
      <Tabs.Screen name="index" options={{ href: social, title: "Feed", tabBarIcon: ({ color }) => <SymbolView name="house.fill" tintColor={color} size={size.icon} /> }} />
      <Tabs.Screen name="passport" options={{ title: "Passport", tabBarAccessibilityLabel: "Passport", tabBarIcon: ({ color }) => <SymbolView name="book.closed.fill" tintColor={color} size={size.icon} /> }} />
      <Tabs.Screen
        name="stamp"
        options={{
          title: "Stamp",
          tabBarAccessibilityLabel: "Stamp a place",
          // A large raised brass button in the middle of the bar.
          tabBarButton: () => (
            <View style={styles.center} pointerEvents="box-none">
              <Pressable
                onPress={() => router.push(status === "signedIn" ? "/stamp/new" : "/sign-in")}
                accessibilityRole="button"
                accessibilityLabel="Stamp a place"
                accessibilityHint="Opens a list of the places you are at"
                style={({ pressed }) => [styles.stampButton, pressed && styles.pressed]}
              >
                <Icon name="seal.fill" color="onAccent" size={size.iconLarge} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarAccessibilityLabel: "Map", tabBarIcon: ({ color }) => <SymbolView name="map.fill" tintColor={color} size={size.icon} /> }} />
      <Tabs.Screen name="activity" options={{ href: social, title: "Activity", tabBarIcon: ({ color }) => <SymbolView name="bell.fill" tintColor={color} size={size.icon} /> }} />
    </Tabs>
  );
}

const BUTTON = size.avatarLarge - space.xs;
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center" },
  stampButton: {
    marginTop: -space.lg,
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: colors.brass,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: size.focusRingWidth,
    borderColor: colors.background,
    ...shadows.glow,
  },
  pressed: { backgroundColor: colors.dimBrass },
});
