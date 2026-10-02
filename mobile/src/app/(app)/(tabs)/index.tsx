import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useFeed } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { AccountGate } from "@/features/account/account-gate";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { StampCard } from "@/features/stamps/stamp-card";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { colors, hairlineWidth, screenPadding, space } from "@/theme";

/**
 * Home: stamps from the people you follow, newest first, 30 at a time. Strictly chronological: no ranking, no
 * suggestions, nothing from people you don't follow. Pull to refresh; more loads near the end.
 */
export default function Home() {
  const { status } = useAuth();
  return (
    <View style={styles.root}>
      {status === "guest" ? (
        <GuestHome />
      ) : (
        <AccountGate title="Home" message="Sign in to see stamps from the people you follow.">
          <Feed />
        </AccountGate>
      )}
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

function GuestHome() {
  return (
    <View style={styles.guest}>
      <Text variant="title2" accessibilityRole="header">
        A passport for New York
      </Text>
      <Text variant="callout" color="textSecondary" style={styles.center}>
        Go somewhere, get a stamp. Sign in to see stamps from the people you follow, or look up a public passport.
      </Text>
      <Button title="Find people" variant="secondary" block={false} onPress={() => router.push("/people")} />
      <Button title="Sign in" block={false} onPress={() => router.push("/sign-in")} />
    </View>
  );
}

function Feed() {
  const feed = useFeed();
  const flagged = useFlaggedIds();
  const [refreshing, setRefreshing] = useState(false);
  const stamps = (feed.data?.pages.flatMap((p) => p.stamps) ?? []).filter((s) => !flagged.has(s.id));

  const refresh = async () => {
    setRefreshing(true);
    await feed.refetch().finally(() => setRefreshing(false));
  };

  if (feed.isPending) return <SkeletonRows count={4} />;
  if (feed.isError && !feed.data) {
    return (
      <View style={styles.pad}>
        <InlineError message={errorText(feed.error, "Couldn't load your feed.")} onRetry={() => void feed.refetch()} retrying={feed.isFetching} />
      </View>
    );
  }
  return (
    <FlashList
      data={stamps}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <StampCard stamp={item} />}
      ItemSeparatorComponent={Separator}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      onEndReachedThreshold={1}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) void feed.fetchNextPage();
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text variant="title2" accessibilityRole="header">
            Nothing here yet
          </Text>
          <Text variant="callout" color="textSecondary" style={styles.center}>
            Stamps from the people you follow show up here, newest first. Follow some people, or go stamp a place yourself.
          </Text>
          <Button title="Find people" block={false} onPress={() => router.push("/people")} />
        </View>
      }
      ListFooterComponent={
        feed.isFetchNextPageError ? (
          <View style={styles.pad}>
            <InlineError message="Couldn't load more stamps." onRetry={() => void feed.fetchNextPage()} retrying={feed.isFetchingNextPage} />
          </View>
        ) : feed.isFetchingNextPage ? (
          <SkeletonRows count={1} />
        ) : null
      }
      contentContainerStyle={styles.list}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: space.xxxl },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginHorizontal: screenPadding },
  pad: { padding: screenPadding },
  empty: { alignItems: "center", gap: space.sm, padding: screenPadding, paddingTop: space.xxxl },
  guest: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: screenPadding },
  center: { textAlign: "center" },
});
