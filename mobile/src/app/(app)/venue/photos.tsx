import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewToken } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/api";
import type { PhotoView } from "@/api/contracts";
import { useFeaturedMonth, useVenue } from "@/api/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { a11yActions, showActions, useContentActions } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { AuthorLine, authorSpoken } from "@/features/people/author-line";
import { useLivePhotos } from "@/features/photos/use-live-photos";
import { DoubleTapToLike, LikeButton } from "@/features/posts/like-button";
import { useLike } from "@/features/posts/use-like";
import { formatAge } from "@/lib/format";
import { colors, radius, screenPadding, size, space, spring } from "@/theme";

const NONE: PhotoView[] = [];
const EPOCH = new Date(0).toISOString();
/** Drag this far (or flick) down to close. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const MAX_ZOOM = 3;

type PhotoSet = "live" | "earlier" | "featured" | "month";

/**
 * Full-screen viewer like Photos: swipe sideways between photos, pinch to zoom, drag down to close,
 * tap to hide the chrome, double-tap to like a shared post. Tracks the photo by id, so expiry or a report never
 * shifts what the menu acts on. Sets: live, earlier, this month's featured, or one month's gallery (`month`).
 */
export default function PhotoViewer() {
  const { id, set, photoId, month } = useLocalSearchParams<{ id: string; set: PhotoSet; photoId?: string; month?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // A month gallery doesn't need the venue page.
  const venue = useVenue(id, set !== "month");
  const buildActions = useContentActions();
  const flagged = useFlaggedIds();
  const page = venue.data;
  const { refetch } = venue;
  const gallery = useFeaturedMonth(id, month ?? "", set === "month" && !!month);
  const like = useLike();

  const onExpire = useCallback(() => void refetch(), [refetch]);
  const live = useLivePhotos(page?.live.livePhotos ?? NONE, page?.now ?? EPOCH, venue.dataUpdatedAt, onExpire);
  const source: PhotoView[] =
    set === "earlier"
      ? (page?.live.earlierPhotos ?? NONE)
      : set === "featured"
        ? (page?.featured.thisMonth.photos ?? NONE)
        : set === "month"
          ? (gallery.data?.nights.flatMap((n) => n.photos) ?? NONE)
          : live;
  const photos = source.filter((p) => !flagged.has(p.id));
  const loaded = set === "month" ? !!gallery.data : !!page;
  const likeOnDoubleTap = (p: PhotoView) => p.likes && !p.mine && like.toggle(p.id, p.likes, true);

  const [currentId, setCurrentId] = useState(photoId ?? null);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const index = photos.findIndex((p) => p.id === currentId);
  const photo = index >= 0 ? photos[index] : undefined;

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<PhotoView>[] }) => {
    const first = viewableItems[0]?.item;
    if (first) setCurrentId(first.id);
  }, []);

  // Drag down to dismiss (off while zoomed, so panning a zoomed photo works).
  const dragY = useSharedValue(0);
  const close = useCallback(() => router.back(), []);
  const pan = Gesture.Pan()
    .enabled(!zoomed)
    .runOnJS(true)
    .activeOffsetY([-space.md, space.md])
    .failOffsetX([-space.sm, space.sm])
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY) close();
      else dragY.value = withSpring(0, spring.snappy);
    });
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(dragY.value), [0, DISMISS_DISTANCE * 2], [1, 0.3], "clamp") }));

  const actions = photo ? buildActions({ targetType: "PHOTO", id: photo.id, author: photo.author, mine: photo.mine }) : [];

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.flex, pageStyle]}>
          {photos.length > 0 && (
            <FlatList
              data={photos}
              keyExtractor={(p) => p.id}
              horizontal
              pagingEnabled
              scrollEnabled={!zoomed}
              // Read once, when the list mounts (it mounts only once photos are loaded).
              initialScrollIndex={Math.max(0, photos.findIndex((p) => p.id === photoId))}
              getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              renderItem={({ item }) => (
                <ScrollView
                  style={{ width, height }}
                  contentContainerStyle={styles.page}
                  maximumZoomScale={MAX_ZOOM}
                  minimumZoomScale={1}
                  centerContent
                  bouncesZoom
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  onScrollEndDrag={(e) => setZoomed((e.nativeEvent.zoomScale ?? 1) > 1.01)}
                  onMomentumScrollEnd={(e) => setZoomed((e.nativeEvent.zoomScale ?? 1) > 1.01)}
                >
                  <DoubleTapToLike enabled={!!item.likes && !item.mine} onDoubleTap={() => likeOnDoubleTap(item)} onSingleTap={() => setChrome((v) => !v)}>
                    <Pressable
                      onLongPress={() => showActions(buildActions({ targetType: "PHOTO", id: item.id, author: item.author, mine: item.mine }))}
                      accessibilityRole="image"
                      accessibilityLabel={`Photo by ${authorSpoken(item.author)}${item.rating ? `, rated ${item.rating} of 10` : ""}${item.caption ? `: ${item.caption}` : ""}`}
                      {...a11yActions(buildActions({ targetType: "PHOTO", id: item.id, author: item.author, mine: item.mine }))}
                      style={{ width, height }}
                    >
                      <PhotoImage uri={mediaUrl(item.url)} id={item.id} />
                    </Pressable>
                  </DoubleTapToLike>
                </ScrollView>
              )}
            />
          )}
        </Animated.View>
      </GestureDetector>

      {chrome && (
        <View style={[styles.top, { top: insets.top + space.xs }]}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={styles.round}>
            <Icon name="xmark" color="textPrimary" size={size.iconSmall} weight="bold" />
          </Pressable>
          {photo && photos.length > 1 && (
            <Text variant="footnote" weight="semibold" tabular>
              {index + 1} of {photos.length}
            </Text>
          )}
          {actions.length > 0 ? (
            <Pressable onPress={() => showActions(actions)} accessibilityRole="button" accessibilityLabel="More options" style={styles.round}>
              <Icon name="ellipsis" color="textPrimary" size={size.iconSmall} weight="bold" />
            </Pressable>
          ) : (
            <View style={styles.round} />
          )}
        </View>
      )}

      {chrome && photo && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
          {set === "earlier" && <Badge label="Not live" onMedia />}
          {!!photo.caption && <Text variant="body">{photo.caption}</Text>}
          <View style={styles.byline}>
            <View style={styles.flex}>
              <AuthorLine author={photo.author} variant="footnote" onMedia modal />
              <Text variant="footnote" color="textSecondary">
                {photo.rating ? `Rated ${photo.rating}/10 · ` : ""}
                {formatAge(photo.createdAt, page?.now ?? new Date())}
              </Text>
            </View>
            {photo.likes && <LikeButton likes={photo.likes} onMedia disabled={photo.mine} onPress={() => photo.likes && like.toggle(photo.id, photo.likes)} />}
          </View>
        </View>
      )}

      {!loaded && (
        <View style={styles.gone}>
          {venue.isError || gallery.isError ? (
            <>
              <Text color="textSecondary">Couldn&apos;t load these photos.</Text>
              <Button
                title="Try again"
                variant="secondary"
                compact
                block={false}
                loading={venue.isFetching || gallery.isFetching}
                onPress={() => void (set === "month" ? gallery.refetch() : refetch())}
              />
            </>
          ) : (
            <ActivityIndicator color={colors.textSecondary} accessibilityLabel="Loading photos" />
          )}
        </View>
      )}
      {!photo && loaded && (
        <View style={styles.gone}>
          <Text color="textSecondary">This photo isn&apos;t available anymore.</Text>
          <Button title="Close" variant="secondary" compact block={false} onPress={close} />
        </View>
      )}
      <ToastHost bottom={insets.bottom + space.xxxl * 2} />
    </GestureHandlerRootView>
  );
}

/** The photo, with a quiet fallback if it fails to load. */
function PhotoImage({ uri, id }: { uri: string; id: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <View style={styles.gone}>
        <Icon name="photo" color="textTertiary" size={size.iconLarge} />
        <Text color="textSecondary">This photo didn&apos;t load.</Text>
      </View>
    );
  return <Image source={{ uri, cacheKey: id }} style={StyleSheet.absoluteFill} contentFit="contain" recyclingKey={id} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  backdrop: { backgroundColor: colors.background },
  page: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  top: { position: "absolute", left: screenPadding, right: screenPadding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: size.hitTarget, height: size.hitTarget, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: screenPadding, paddingTop: space.lg, gap: space.xs, backgroundColor: colors.scrim },
  byline: { flexDirection: "row", alignItems: "center", gap: space.md },
  gone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: space.md },
});
