import { Stack, type Href } from "expo-router";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { LEGAL, openWebPage } from "@/lib/links";
import { colors, fonts, screenPadding, space, pressedOpacity } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const user = me.data?.user;

  const refresh = async () => {
    setRefreshing(true);
    await me.refetch().finally(() => setRefreshing(false));
  };

  // One sign-out at a time: the button shows progress and ignores further taps while it runs (P-144).
  const runSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    if (signingOut) return;
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void runSignOut() },
    ]);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Tappable onPress={() => nav.back()} style={styles.hitTarget} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Tappable>
      </View>
      <NativeText style={styles.title}>Settings</NativeText>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        {me.isError && !user ? (
          <InlineError message={errorText(me.error, "Couldn't load your account.")} onRetry={() => void refresh()} retrying={refreshing} />
        ) : null}
        <SettingsRow title="Edit profile" subtitle={user ? `${user.displayName} · @${user.handle}` : undefined} trailing="chevron.right" onPress={() => nav.push("/edit-profile")} />
        <SettingsRow title="Email" subtitle={user?.email} subtitleEllipsis="middle" trailing="chevron.right" onPress={() => nav.push("/settings/email" as Href)} />
        <View style={styles.privacyNote}>
          <Text variant="footnote" color="textSecondary">Your passport is private, and there is no feed.</Text>
          <Text variant="footnote" color="textSecondary">Only collections you choose to share get a link.</Text>
        </View>
        {/* Not built yet: a "Soon" tag instead of a chevron, so it doesn't read as working navigation (P-146). */}
        <SettingsRow title="Customize" subtitle="Covers, paper and inks" badge="Soon" accessibilityHint="Coming soon" onPress={() => nav.push("/customize")} />
        <SettingsRow title="Privacy policy" subtitle="Opens in your browser" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.privacy)} />
        <SettingsRow title="Terms" subtitle="Opens in your browser" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.terms)} />
        <SettingsRow title="Support" subtitle="Get help" trailing="arrow.up.right" onPress={() => openWebPage(LEGAL.support)} />
        {__DEV__ ? <SettingsRow title="Design gallery" subtitle="Development" trailing="chevron.right" onPress={() => nav.push("/design")} /> : null}
        <View style={styles.actions}>
          <Button title="Sign out" variant="plain" onPress={confirmSignOut} loading={signingOut} />
        </View>
        {/* Set apart from Sign out, in the danger colour (P-142). */}
        <View style={styles.danger}>
          <Button title="Delete account" variant="destructive" onPress={() => nav.push("/settings/delete-account")} disabled={signingOut} />
        </View>
        {user ? <Text variant="footnote" color="textTertiary">Member since {new Date(user.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text> : null}
      </ScrollView>
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  subtitleEllipsis?: "tail" | "middle";
  trailing?: "chevron.right" | "arrow.up.right";
  /** Shown in place of the trailing icon. */
  badge?: string;
  accessibilityHint?: string;
  onPress: () => void;
};

function SettingsRow({ title, subtitle, subtitleEllipsis = "tail", trailing, badge, accessibilityHint, onPress }: RowProps) {
  const label = [title, subtitle].filter(Boolean).join(", ");
  return (
    <Tappable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}>
      <View style={styles.rowCopy}>
        <NativeText style={styles.rowTitle}>{title}</NativeText>
        {subtitle ? <NativeText style={styles.rowSubtitle} numberOfLines={1} ellipsizeMode={subtitleEllipsis}>{subtitle}</NativeText> : null}
      </View>
      {badge ? <Badge label={badge} /> : trailing ? <Icon name={trailing} color="textTertiary" size={16} /> : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
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
  danger: { paddingTop: space.xl, paddingBottom: space.sm },
  pressed: { opacity: pressedOpacity },
});
