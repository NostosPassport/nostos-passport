import { router, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Icon } from "@/components/ui/icon";
import { colors, size, space } from "@/theme";

/** Home, Stamp, Activity, Passport. The middle tab doesn't open a screen of its own: it starts a new stamp. */
export default function TabsLayout() {
  const { status } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <SymbolView name="house.fill" tintColor={color} size={size.icon} />,
          headerRight: () => (
            <Pressable onPress={() => router.push("/people")} accessibilityRole="button" accessibilityLabel="Find people" hitSlop={space.xs} style={{ paddingHorizontal: space.md }}>
              <Icon name="magnifyingglass" color="accent" size={size.icon} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="stamp"
        options={{ title: "Stamp", tabBarIcon: ({ color }) => <SymbolView name="plus.circle.fill" tintColor={color} size={size.iconLarge} /> }}
        listeners={{
          tabPress: (e) => {
            // Starting a stamp is an action, not a place: open the composer (or sign-in) over whatever tab is showing.
            e.preventDefault();
            router.push(status === "signedIn" ? "/stamp/new" : "/sign-in");
          },
        }}
      />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: ({ color }) => <SymbolView name="bell.fill" tintColor={color} size={size.icon} /> }} />
      <Tabs.Screen name="passport" options={{ title: "Passport", tabBarIcon: ({ color }) => <SymbolView name="person.crop.square.fill" tintColor={color} size={size.icon} /> }} />
    </Tabs>
  );
}
