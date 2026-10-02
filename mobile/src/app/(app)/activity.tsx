import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { errorText, mediaUrl } from "@/api";
import type { ActivityResponse } from "@/api/contracts";
import { useActivity } from "@/api/queries";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PersonRow } from "@/features/people/person-row";
import { formatAge } from "@/lib/format";
import { colors, radius, screenPadding, size, space } from "@/theme";

type Item = ActivityResponse["items"][number];

/** In-app activity, last 30 days: follow requests, new followers, likes on your posts, featured photos. No push. */
export default function Activity() {
  const activity = useActivity();
  const [refreshing, setRefreshing] = useState(false);
  const items = activity.data?.items ?? [];

  const refresh = async () => {
    setRefreshing(true);
    await activity.refetch().finally(() => setRefreshing(false));
  };

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
    >
      {activity.isPending ? (
        <SkeletonRows count={6} />
      ) : activity.isError ? (
        <InlineError message={errorText(activity.error, "Couldn't load activity.")} onRetry={() => void activity.refetch()} retrying={activity.isFetching} />
      ) : items.length === 0 ? (
        <Text variant="callout" color="textSecondary">
          Nothing yet. Follows, likes and featured photos show up here.
        </Text>
      ) : (
        <ListGroup>
          {items.map((item, i) => (
            <ActivityRow key={`${item.kind}-${item.at}-${i}`} item={item} />
          ))}
        </ListGroup>
      )}
    </ScrollView>
  );
}

function ActivityRow({ item }: { item: Item }) {
  const age = formatAge(item.at);
  const openPost = (id: string) => router.push({ pathname: "/post/[id]", params: { id } });
  switch (item.kind) {
    case "follow_request":
      return <PersonRow person={item.person} subtitle={`Asked to follow you · ${age}`} onPress={() => router.push("/follow-requests")} accessibilityHint="Opens follow requests" />;
    case "new_follower":
      return <PersonRow person={item.person} subtitle={`Started following you · ${age}`} />;
    case "like":
      return (
        <PersonRow
          person={item.person}
          subtitle={`Liked your post at ${item.post.venue.name} · ${age}`}
          trailing={<Thumb url={item.post.url} />}
          onPress={() => openPost(item.post.id)}
          accessibilityHint="Opens the post"
        />
      );
    case "featured":
      return (
        <ListRow
          icon="rosette"
          title={`You were featured at ${item.post.venue.name}`}
          subtitle={age}
          trailing={<Thumb url={item.post.url} />}
          onPress={() => openPost(item.post.id)}
          accessibilityHint="Opens the post"
        />
      );
  }
}

function Thumb({ url }: { url: string }) {
  return <Image source={{ uri: mediaUrl(url) }} style={styles.thumb} contentFit="cover" transition={150} accessible={false} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  thumb: { width: size.avatar, height: size.avatar, borderRadius: radius.chip - space.xxs, backgroundColor: colors.elevated },
});
