import { Stack } from "expo-router";

import { stackOptions } from "@/components/ui/stack-options";
import { colors, radius } from "@/theme";

export default function AppLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="stamp/[id]" options={{ title: "Stamp" }} />
      <Stack.Screen name="stamp/new" options={{ title: "New stamp", presentation: "modal" }} />
      <Stack.Screen name="stamp/edit" options={{ title: "Edit stamp", presentation: "modal" }} />
      <Stack.Screen name="stamp/song" options={{ title: "Add a song", presentation: "modal" }} />
      {/* Pushed from a passport, a stamp or the feed. */}
      <Stack.Screen name="user/[handle]" options={{ title: "" }} />
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
      <Stack.Screen name="follow-requests" options={{ title: "Follow requests" }} />
      <Stack.Screen name="connections" options={{ title: "" }} />
      <Stack.Screen name="people" options={{ title: "Find people" }} />
      <Stack.Screen name="settings/blocked" options={{ title: "Blocked users" }} />
      <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />
      <Stack.Screen name="moderation" options={{ title: "Moderation", headerLargeTitle: true }} />
    </Stack>
  );
}
