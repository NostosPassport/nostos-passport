import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useFeaturedMonth } from "@/api/queries";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { useContentActions } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { FeaturedTile } from "@/features/venue/featured-section";
import { formatNight, monthBest } from "@/lib/format";
import { colors, screenPadding, space } from "@/theme";

const COLUMNS = 3;

/** One month's featured gallery for a venue ("September's best"): each night's top photos, newest night first. */
export default function FeaturedMonth() {
  const { id, month } = useLocalSearchParams<{ id: string; month: string }>();
  const gallery = useFeaturedMonth(id, month);
  const flagged = useFlaggedIds();
  const buildActions = useContentActions();
  const [width, setWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const tile = width > 0 ? (width - space.xs * (COLUMNS - 1)) / COLUMNS : 0;
  const nights = (gallery.data?.nights ?? []).map((n) => ({ ...n, photos: n.photos.filter((p) => !flagged.has(p.id)) })).filter((n) => n.photos.length > 0);

  const refresh = async () => {
    setRefreshing(true);
    await gallery.refetch().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: monthBest(month, new Date().getFullYear()), headerLeft: () => <HeaderButton label="Done" bold onPress={() => router.back()} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.body}>
          {gallery.isPending ? (
            <SkeletonRows count={4} />
          ) : gallery.isError ? (
            <InlineError message={errorText(gallery.error, "Couldn't load this gallery.")} onRetry={() => void gallery.refetch()} retrying={gallery.isFetching} />
          ) : nights.length === 0 ? (
            <Text variant="callout" color="textSecondary">
              Nothing was featured this month.
            </Text>
          ) : (
            tile > 0 &&
            nights.map((n) => (
              <View key={n.night} style={styles.night}>
                <Text variant="headline" accessibilityRole="header">
                  {formatNight(n.night)}
                </Text>
                <View style={styles.grid}>
                  {n.photos.map((p) => (
                    <FeaturedTile
                      key={p.id}
                      photo={p}
                      size={tile}
                      onPress={() => router.push({ pathname: "/venue/photos", params: { id, set: "month", month, photoId: p.id } })}
                      actions={buildActions({ targetType: "PHOTO", id: p.id, author: p.author, mine: p.mine })}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl },
  body: { gap: space.xl },
  night: { gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
