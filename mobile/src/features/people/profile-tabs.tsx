import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { errorText, mediaUrl } from "@/api";
import type { PostTile } from "@/api/contracts";
import { useUserPlaces, type useUserPosts } from "@/api/queries";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { colors, hairlineWidth, pressedOpacity, radius, size, space } from "@/theme";
import { placesRegion } from "./places";

const COLUMNS = 3;

/** The Posts tab: a 3-column grid, newest first. The screen's scroll view asks for the next page near the end. */
export function PostsGrid({ posts, own }: { posts: ReturnType<typeof useUserPosts>; own: boolean }) {
  const [width, setWidth] = useState(0);
  const tile = width > 0 ? (width - space.xxs * (COLUMNS - 1)) / COLUMNS : 0;
  const tiles = posts.data?.pages.flatMap((p) => p.posts) ?? [];
  // A failed next page leaves the query in error with the earlier pages kept: keep showing them.
  const nextPageFailed = posts.isFetchNextPageError;
  const loadMore = () => void posts.fetchNextPage();

  if (posts.isPending) return <SkeletonRows count={3} />;
  if (!posts.data) return <InlineError message={errorText(posts.error, "Couldn't load posts.")} onRetry={() => void posts.refetch()} retrying={posts.isFetching} />;
  if (tiles.length === 0) {
    return (
      <Text variant="callout" color="textSecondary">
        {own ? "Your posts show here. Take a photo at a bar and rate it." : "No posts yet."}
      </Text>
    );
  }
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tile > 0 && tiles.map((p) => <Tile key={p.id} post={p} size={tile} own={own} />)}
      {posts.isFetchingNextPage && (
        <View style={styles.more}>
          <Skeleton width={tile} height={tile} />
        </View>
      )}
      {nextPageFailed && <InlineError message="Couldn't load more posts." onRetry={loadMore} retrying={posts.isFetchingNextPage} />}
    </View>
  );
}

const Tile = memo(function Tile({ post, size: side, own }: { post: PostTile; size: number; own: boolean }) {
  const label = `${post.venue.name}, rated ${post.rating} of 10${own && !post.shared ? ", only on your profile" : ""}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the post"
      style={({ pressed }) => [{ width: side, height: side }, styles.tile, pressed && styles.pressed]}
    >
      <Image source={{ uri: mediaUrl(post.url), cacheKey: post.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={post.id} cachePolicy="memory-disk" />
      <View style={styles.rating}>
        <Text variant="caption" weight="semibold" tabular maxFontSizeMultiplier={1.2}>
          {post.rating}
        </Text>
      </View>
      {own && !post.shared && (
        <View style={styles.unshared}>
          <Icon name="eye.slash.fill" color="textPrimary" size={size.iconTiny} />
        </View>
      )}
    </Pressable>
  );
});

/** The Places tab: a small dark map of every venue they've posted at, plus a list with their latest rating. */
export function PlacesTab({ handle }: { handle: string }) {
  const places = useUserPlaces(handle);
  const list = places.data?.places ?? [];
  const region = placesRegion(list);

  if (places.isPending) return <SkeletonRows count={3} />;
  if (places.isError) return <InlineError message={errorText(places.error, "Couldn't load places.")} onRetry={() => void places.refetch()} retrying={places.isFetching} />;
  if (list.length === 0 || !region) {
    return (
      <Text variant="callout" color="textSecondary">
        No places yet.
      </Text>
    );
  }
  return (
    <View style={styles.places}>
      <View style={styles.mapWrap} accessible accessibilityLabel={`Map of ${plural(list.length, "place")}`}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          userInterfaceStyle="dark"
          showsPointsOfInterests={false}
          showsCompass={false}
          showsScale={false}
          showsBuildings={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          toolbarEnabled={false}
          importantForAccessibility="no-hide-descendants"
        >
          {list.map((p) => (
            <Marker key={p.venue.slug} coordinate={{ latitude: p.venue.lat, longitude: p.venue.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.dot} />
            </Marker>
          ))}
        </MapView>
      </View>
      <ListGroup>
        {list.map((p) => (
          <ListRow
            key={p.venue.slug}
            title={p.venue.name}
            subtitle={`${p.venue.neighborhood} · ${plural(p.posts, "post")}`}
            trailing={
              <Text variant="headline" tabular>
                {p.lastRating}
              </Text>
            }
            chevron
            accessibilityLabel={`${p.venue.name}, rated ${p.lastRating} of 10, ${plural(p.posts, "post")}`}
            onPress={() => router.push({ pathname: "/venue/[id]", params: { id: p.venue.slug } })}
          />
        ))}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xxs },
  tile: { backgroundColor: colors.elevated, overflow: "hidden" },
  pressed: { opacity: pressedOpacity },
  rating: {
    position: "absolute",
    left: space.xxs,
    bottom: space.xxs,
    minWidth: size.markerBadge + space.xxs,
    paddingHorizontal: space.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.scrim,
    alignItems: "center",
  },
  unshared: { position: "absolute", right: space.xxs, top: space.xxs },
  more: { width: "100%" },
  places: { gap: space.lg },
  mapWrap: { height: size.heroHeight, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.surface },
  dot: { width: size.vibeDot, height: size.vibeDot, borderRadius: size.vibeDot / 2, backgroundColor: colors.textPrimary, borderWidth: hairlineWidth, borderColor: colors.background },
});
