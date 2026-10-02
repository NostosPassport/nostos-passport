import { Stack } from "expo-router";

import { stackOptions } from "@/components/ui/stack-options";
import { colors, radius } from "@/theme";

export default function AppLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="venue/[id]"
        options={{
          // Standard iOS card sheet: the map stays visible behind it at the top; swipe down to dismiss.
          // (The detent-based formSheet left the scroll content blank on device.)
          presentation: "modal",
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <Stack.Screen
        name="venue/report"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetGrabberVisible: true,
          sheetCornerRadius: radius.sheet,
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <Stack.Screen
        name="venue/photo"
        options={{ presentation: "fullScreenModal", headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
      <Stack.Screen
        name="venue/photos"
        // Transparent so dragging down reveals the venue behind, like Photos.
        options={{ presentation: "transparentModal", headerShown: false, animation: "fade", contentStyle: { backgroundColor: colors.transparent } }}
      />
      {/* Pushed from Profile and People; a modal when opened from inside the venue sheet (it must present above it). */}
      <Stack.Screen
        name="user/[handle]"
        options={({ route }) => ({ title: "", presentation: (route.params as { modal?: string } | undefined)?.modal ? "modal" : "card" })}
      />
      <Stack.Screen name="location-permission" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6], sheetGrabberVisible: true, sheetCornerRadius: radius.sheet, headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      <Stack.Screen name="profile" options={{ title: "" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings", headerLargeTitle: true }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit profile", presentation: "modal" }} />
      <Stack.Screen name="follow-requests" options={{ title: "Follow requests" }} />
      <Stack.Screen name="activity" options={{ title: "Activity", headerLargeTitle: true }} />
      <Stack.Screen name="connections" options={{ title: "" }} />
      <Stack.Screen name="post/[id]" options={{ title: "Post" }} />
      <Stack.Screen name="post/edit" options={{ title: "Edit post", presentation: "modal" }} />
      {/* A modal: it opens from inside the venue sheet and must present above it. */}
      <Stack.Screen name="venue/featured" options={{ title: "", presentation: "modal" }} />
      <Stack.Screen name="people" options={{ title: "Find people" }} />
      <Stack.Screen name="settings/blocked" options={{ title: "Blocked users" }} />
      <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />
      <Stack.Screen name="owner/[venueId]" options={{ title: "", headerLargeTitle: true }} />
      <Stack.Screen name="owner/edit" options={{ title: "Details" }} />
      <Stack.Screen name="owner/hours" options={{ title: "Hours" }} />
      <Stack.Screen name="owner/promo" options={{ title: "New promo" }} />
      <Stack.Screen name="moderation" options={{ title: "Moderation", headerLargeTitle: true }} />
    </Stack>
  );
}
