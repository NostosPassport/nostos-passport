import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { mapRecenter } from "@/features/map/recenter";
import { colors, pressedOpacity, size } from "@/theme";
import { nav } from "@/lib/nav";

/** Passport is the tab the app opens on. SDK 58 moved this from the `initialRouteName` prop to `unstable_settings.anchor`. */
export const unstable_settings = { anchor: "passport" };

export default function TabsLayout() {
  // 56pt of bar plus the home-indicator inset: no empty band on iPhone SE, no clipped labels (P-003).
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: [styles.bar, { height: size.tabBar + insets.bottom }],
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textPrimary,
      }}
    >
      <Tabs.Screen name="passport" options={{ title: "Passport", tabBarAccessibilityLabel: "Passport", tabBarIcon: ({ color }) => <SymbolView name="book.closed" tintColor={color} size={23} /> }} />
      <Tabs.Screen
        name="stamp"
        options={{
          title: "Stamp",
          tabBarAccessibilityLabel: "Stamp a place",
          tabBarButton: () => (
            <View style={styles.center} pointerEvents="box-none">
              <Pressable onPress={() => nav.push("/stamp/new")} accessibilityRole="button" accessibilityLabel="Stamp a place" style={({ pressed }) => [styles.stampButton, pressed && styles.pressed]}>
                <Icon name="plus" color="accent" size={24} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        listeners={{ tabPress: () => mapRecenter.request() }}
        options={{ title: "Map", tabBarAccessibilityLabel: "Map", tabBarIcon: ({ color }) => <SymbolView name="map" tintColor={color} size={23} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.background, borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  item: { paddingTop: 2 },
  label: { fontSize: 12, lineHeight: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: 3 },
  stampButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  pressed: { opacity: pressedOpacity },
});
