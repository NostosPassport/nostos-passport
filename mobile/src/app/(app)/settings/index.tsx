import { router, Stack, type Href } from "expo-router";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { LEGAL, openWebPage } from "@/lib/links";
import { colors, fonts, screenPadding, space } from "@/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const user = me.data?.user;
  const staff = user?.role === "MODERATOR" || user?.role === "ADMIN";

  const refresh = async () => {
    setRefreshing(true);
    await me.refetch().finally(() => setRefreshing(false));
  };

  const confirmSignOut = () => Alert.alert("Sign out?", undefined, [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => void signOut() },
  ]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.hitTarget} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Pressable>
      </View>
      <NativeText style={styles.title}>Settings</NativeText>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        <SettingsRow title="Edit profile" subtitle={user ? `${user.displayName} · @${user.handle}` : undefined} trailing="chevron.right" onPress={() => router.push("/edit-profile")} />
        <SettingsRow title="Email" subtitle={user?.email} trailing="chevron.right" onPress={() => router.push("/settings/email" as Href)} />
        <View style={styles.privacyNote}>
          <Text variant="footnote" color="textSecondary">Only you can see your passport.</Text>
          <Text variant="footnote" color="textSecondary">Nothing is shared, and there is no feed.</Text>
        </View>
        <SettingsRow title="Customize" subtitle="Coming soon" trailing="chevron.right" onPress={() => router.push("/customize")} />
        <SettingsRow title="Privacy policy" subtitle="Opens in your browser" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.privacy)} />
        <SettingsRow title="Terms" subtitle="Opens in your browser" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.terms)} />
        <SettingsRow title="Support" subtitle="Get help" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.support)} />
        {staff ? <SettingsRow title="Moderation" subtitle="Staff tools" trailing="chevron.right" onPress={() => router.push("/moderation")} /> : null}
        {__DEV__ ? <SettingsRow title="Design gallery" subtitle="Development" trailing="chevron.right" onPress={() => router.push("/design")} /> : null}
        <View style={styles.actions}>
          <Button title="Sign out" variant="plain" onPress={confirmSignOut} />
          <Button title="Delete account" variant="secondary" onPress={() => router.push("/settings/delete-account")} />
        </View>
        {user ? <Text variant="footnote" color="textTertiary">Member since {new Date(user.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Text> : null}
      </ScrollView>
    </View>
  );
}

function SettingsRow({ title, subtitle, trailing, onPress }: { title: string; subtitle?: string; trailing?: "chevron.right" | "arrow.up.right"; onPress: () => void }) {
  const label = [title, subtitle].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.rowCopy}>
        <NativeText style={styles.rowTitle}>{title}</NativeText>
        {subtitle ? <NativeText style={styles.rowSubtitle}>{subtitle}</NativeText> : null}
      </View>
      {trailing ? <Icon name={trailing} color="textTertiary" size={16} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  nav: { height: 92, paddingHorizontal: screenPadding, justifyContent: "flex-end" },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11 },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7, paddingHorizontal: screenPadding, marginTop: 10, marginBottom: 42 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: screenPadding, gap: 8 },
  row: { minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1, gap: 7 },
  rowTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 27, lineHeight: 28, letterSpacing: -0.5 },
  rowSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 15 },
  privacyNote: { paddingVertical: 3 },
  actions: { gap: space.sm, paddingTop: space.sm },
  pressed: { opacity: 0.65 },
});
