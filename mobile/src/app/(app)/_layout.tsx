import { Stack } from "expo-router";

import { stackOptions } from "@/components/ui/stack-options";
import { colors, radius } from "@/theme";

export default function AppLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="place/[id]" options={{ title: "Place" }} />
      <Stack.Screen name="stamp/[id]" options={{ title: "Stamp" }} />
      <Stack.Screen name="stamp/new" options={{ presentation: "modal", headerShown: false, headerBackButtonMenuEnabled: false }} />
      <Stack.Screen name="stamp/camera" options={{ presentation: "fullScreenModal", headerShown: false }} />
      <Stack.Screen name="stamp/landed" options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
      <Stack.Screen name="stamp/edit" options={{ title: "Edit stamp", presentation: "modal" }} />
      <Stack.Screen name="stamp/song" options={{ title: "Add a song", presentation: "modal" }} />
      <Stack.Screen name="collections/index" options={{ title: "Collections", headerLargeTitle: true }} />
      <Stack.Screen name="collections/new" options={{ title: "Create collection", presentation: "modal" }} />
      <Stack.Screen name="collections/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="collections/[id]/edit" options={{ title: "Edit collection", presentation: "modal" }} />
      <Stack.Screen
        name="location-permission"
        options={{ presentation: "formSheet", sheetAllowedDetents: [0.6], sheetGrabberVisible: true, sheetCornerRadius: radius.sheet, headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
      />
      <Stack.Screen
        name="customize"
        options={{ presentation: "formSheet", sheetAllowedDetents: [0.4], sheetGrabberVisible: true, sheetCornerRadius: radius.sheet, headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
      />
      <Stack.Screen name="settings/index" options={{ title: "Settings", headerLargeTitle: true }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit profile", presentation: "modal" }} />
      <Stack.Screen name="settings/email" options={{ title: "Email" }} />
      <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />
    </Stack>
  );
}
