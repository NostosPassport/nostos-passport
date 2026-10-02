import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { errorText, mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { useUserPlaces, type useUserStamps } from "@/api/queries";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { colors, hairlineWidth, pressedOpacity, radius, size, space } from "@/theme";
import { placesRegion } from "./places";

const COLUMNS = 3;

/** The Stamps tab: a 3-column grid, newest first. The screen's scroll view asks for the next page near the end. */
export function StampsGrid({ stamps, own }: { stamps: ReturnType<typeof useUserStamps>; own: boolean }) {
  const [width, setWidth] = useState(0);
  const tile = width > 0 ? (width - space.xxs * (COLUMNS - 1)) / COLUMNS : 0;
  const tiles = stamps.data?.pages.flatMap((p) => p.stamps) ?? [];
  // A failed next page leaves the query in error with the earlier pages kept: keep showing them.
  const nextPageFailed = stamps.isFetchNextPageError;
  const loadMore = () => void stamps.fetchNextPage();

  if (stamps.isPending) return <SkeletonRows count={3} />;
  if (!stamps.data) return <InlineError message={errorText(stamps.error, "Couldn't load stamps.")} onRetry={() => void stamps.refetch()} retrying={stamps.isFetching} />;
  if (tiles.length === 0) {
    return (
      <Text variant="callout" color="textSecondary">
        {own ? "Your stamps show here. Go to a place and tap Stamp." : "No stamps yet."}
      </Text>
    );
  }
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tile > 0 && tiles.map((s) => <Tile key={s.id} stamp={s} size={tile} />)}
      {stamps.isFetchingNextPage && (
        <View style={styles.more}>
          <Skeleton width={tile} height={tile} />
        </View>
      )}
      {nextPageFailed && <InlineError message="Couldn't load more stamps." onRetry={loadMore} retrying={stamps.isFetchingNextPage} />}
    </View>
  );
}

/** A grid tile: the photo when there is one, otherwise the caption or the song on a plain tile. */
const Tile = memo(function Tile({ stamp, size: side }: { stamp: StampView; size: number }) {
  const label = [`Stamp at ${stamp.place.name}`, stamp.caption || null, stamp.song ? `Song: ${stamp.song.title}` : null].filter(Boolean).join(", ");
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the stamp"
      style={({ pressed }) => [{ width: side, height: side }, styles.tile, pressed && styles.pressed]}
    >
      {stamp.photoUrl ? (
        <Image source={{ uri: mediaUrl(stamp.photoUrl), cacheKey: stamp.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={stamp.id} cachePolicy="memory-disk" />
      ) : (
        <View style={styles.textTile}>
          <Icon name={stamp.song ? "music.note" : "text.quote"} color="textTertiary" size={size.iconSmall} />
          <Text variant="caption" color="textSecondary" numberOfLines={3}>
            {stamp.caption || stamp.song?.title}
          </Text>
        </View>
      )}
      <View style={styles.placeTag}>
        <Text variant="caption" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {stamp.place.name}
        </Text>
      </View>
    </Pressable>
  );
});

/** The Places view: a small dark map of every place they've stamped, plus a list with their stamp count at each. */
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
            <Marker key={p.place.slug} coordinate={{ latitude: p.place.lat, longitude: p.place.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.dot} />
            </Marker>
          ))}
        </MapView>
      </View>
      <ListGroup>
        {list.map((p) => (
          <ListRow
            key={p.place.slug}
            title={p.place.name}
            subtitle={`${p.place.neighborhood} · ${plural(p.stamps, "stamp")}`}
            trailing={
              <Text variant="headline" tabular>
                {p.stamps}
              </Text>
            }
            chevron
            accessibilityLabel={`${p.place.name}, ${plural(p.stamps, "stamp")}`}
            accessibilityHint="Opens the latest stamp there"
            onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: p.latestStamp.id } })}
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
  textTile: { flex: 1, padding: space.xs, gap: space.xxs, justifyContent: "center" },
  placeTag: {
    position: "absolute",
    left: space.xxs,
    right: space.xxs,
    bottom: space.xxs,
    paddingHorizontal: space.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.scrim,
  },
  more: { width: "100%" },
  places: { gap: space.lg },
  mapWrap: { height: size.heroHeight, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.surface },
  dot: { width: size.vibeDot, height: size.vibeDot, borderRadius: size.vibeDot / 2, backgroundColor: colors.textPrimary, borderWidth: hairlineWidth, borderColor: colors.background },
});
