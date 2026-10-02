import { router } from "expo-router";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useState } from "react";

import { errorText } from "@/api";
import { useFollowing, useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { LEGAL, openWebPage } from "@/lib/links";
import { colors, screenPadding, space } from "@/theme";

/** Settings: who I follow and where they're going, venue and moderation entries, account and legal. */
export default function Settings() {
  const me = useMe();
  const following = useFollowing();
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const user = me.data?.user;
  const staff = user?.role === "MODERATOR" || user?.role === "ADMIN";

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([me.refetch(), following.refetch()]).finally(() => setRefreshing(false));
  };

  const confirmSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  const list = following.data?.following ?? [];

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        {staff && (
          <ListGroup>
            <ListRow icon="shield.lefthalf.filled" iconColor="accent" title="Moderation" chevron onPress={() => router.push("/moderation")} />
          </ListGroup>
        )}

        <ListGroup header="Following">
          {following.isPending ? (
            <View style={styles.pad}>
              <Skeleton width="60%" />
            </View>
          ) : following.isError ? (
            <View style={styles.pad}>
              <InlineError message={errorText(following.error, "Couldn't load who you follow.")} onRetry={() => void following.refetch()} />
            </View>
          ) : list.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="callout" color="textSecondary">
                You&apos;re not following anyone yet.
              </Text>
              <Button title="Find people" variant="plain" compact block={false} onPress={() => router.push("/people")} />
            </View>
          ) : (
            list.map((f) => (
              <ListRow
                key={f.handle}
                leading={<Avatar name={f.displayName} uri={f.avatarUrl} />}
                title={f.displayName}
                titleAccessory={f.verified ? <VerifiedBadge accessible={false} /> : undefined}
                accessibilityLabel={[f.displayName, `@${f.handle}`, f.verified ? "verified" : null].filter(Boolean).join(", ")}
                subtitle={`@${f.handle}`}
                chevron
                onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: f.handle } })}
              />
            ))
          )}
          {list.length > 0 && <ListRow icon="person.badge.plus" iconColor="accent" title="Find people" titleColor="accent" onPress={() => router.push("/people")} />}
        </ListGroup>

        <ListGroup header="Settings">
          <ListRow icon="hand.raised.fill" title="Blocked users" chevron onPress={() => router.push("/settings/blocked")} />
          <ListRow icon="lock.fill" title="Privacy policy" external onPress={() => openWebPage(LEGAL.privacy)} />
          <ListRow icon="doc.text.fill" title="Terms" external onPress={() => openWebPage(LEGAL.terms)} />
          <ListRow icon="questionmark.circle.fill" title="Support" external onPress={() => openWebPage(LEGAL.support)} />
        </ListGroup>

        <ListGroup>
          <ListRow icon="rectangle.portrait.and.arrow.right" title="Sign out" onPress={confirmSignOut} />
          <ListRow
            icon="trash.fill"
            iconColor="danger"
            title="Delete account"
            titleColor="danger"
            onPress={() => router.push("/settings/delete-account")}
            accessibilityHint="Opens the account deletion screen"
          />
        </ListGroup>

        {user && (
          <Text variant="footnote" color="textTertiary" style={styles.since}>
            Member since {new Date(user.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.xl },
  pad: { padding: space.md },
  empty: { padding: space.md, gap: space.xs, alignItems: "flex-start" },
  since: { paddingHorizontal: space.md },
});
