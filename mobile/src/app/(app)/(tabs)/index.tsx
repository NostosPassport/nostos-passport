import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useFeed } from "@/api/queries";
import { AccountGate } from "@/features/account/account-gate";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { StampCard } from "@/features/stamps/stamp-card";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { colors, hairlineWidth, screenPadding, space } from "@/theme";

export default function Home() {
  return (
    <View style={styles.root}>
      <AccountGate title="Home" message="Loading your passport.">
        <Feed />
      </AccountGate>
      <ToastHost bottom={space.xxl} />
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
            There are no stamps to show here yet.
          </Text>
          <Button title="Stamp a place" block={false} onPress={() => router.push("/stamp/new")} />
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
  center: { textAlign: "center" },
});
