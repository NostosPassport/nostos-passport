import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { mediaUrl } from "@/api";
import type { FeaturedPhotoView, VenuePageResponse } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { a11yActions, showActions, useContentActions } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { authorSpoken } from "@/features/people/author-line";
import { formatNight, monthBest, plural } from "@/lib/format";
import { colors, pressedOpacity, radius, size, space } from "@/theme";

const COLUMNS = 3;
/** Tiles shown on the venue page before "See all". */
export const PREVIEW_COUNT = 6;

/**
 * "This month's best" (featured photos from the current New York month, newest night first) and the archive of
 * past months ("August's best"). Featuring is decided by eligible likes each night; the venue can't change it.
 */
export function FeaturedSection({ venueId, featured }: { venueId: string; featured: VenuePageResponse["featured"] }) {
  const [width, setWidth] = useState(0);
  const flagged = useFlaggedIds();
  const buildActions = useContentActions();
  const tile = width > 0 ? (width - space.xs * (COLUMNS - 1)) / COLUMNS : 0;
  const { thisMonth, archive } = featured;
  const photos = thisMonth.photos.filter((p) => !flagged.has(p.id)).slice(0, PREVIEW_COUNT);
  const year = Number(thisMonth.month.slice(0, 4));
  const openMonth = (month: string) => router.push({ pathname: "/venue/featured", params: { id: venueId, month } });
  const openPhoto = (photoId: string) => router.push({ pathname: "/venue/photos", params: { id: venueId, set: "featured", photoId } });

  return (
    <Section title="This month's best">
      <View testID="featured-body" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.body}>
        {photos.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            Nothing featured yet this month. Each night&apos;s most-liked shared photos land here.
          </Text>
        ) : (
          tile > 0 && (
            <View style={styles.grid}>
              {photos.map((p) => (
                <FeaturedTile key={p.id} photo={p} size={tile} onPress={() => openPhoto(p.id)} actions={buildActions({ targetType: "PHOTO", id: p.id, author: p.author, mine: p.mine })} />
              ))}
            </View>
          )
        )}
        {thisMonth.total > photos.length && (
          <Button title={`See all ${thisMonth.total}`} variant="plain" compact block={false} onPress={() => openMonth(thisMonth.month)} />
        )}
        {archive.length > 0 && (
          <ListGroup header="Past months">
            {archive.map((a) => (
              <ListRow key={a.month} icon="rosette" title={monthBest(a.month, year)} subtitle={plural(a.count, "photo")} chevron onPress={() => openMonth(a.month)} />
            ))}
          </ListGroup>
        )}
      </View>
    </Section>
  );
}

type TileProps = { photo: FeaturedPhotoView; size: number; onPress: () => void; actions: ReturnType<ReturnType<typeof useContentActions>> };

/** A featured photo: the image and its like count. Report and Block stay on every photo. */
export const FeaturedTile = memo(function FeaturedTile({ photo, size: s, onPress, actions }: TileProps) {
  const label = `Featured photo by ${authorSpoken(photo.author)}, ${formatNight(photo.night)}, ${plural(photo.likes.count, "like")}`;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={actions.length ? () => showActions(actions) : undefined}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityHint="Opens the photo"
      {...a11yActions(actions)}
      style={({ pressed }) => [styles.tile, { width: s, height: s }, pressed && styles.pressed]}
    >
      <Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={photo.id} cachePolicy="memory-disk" />
      <View style={styles.likes}>
        <Icon name={photo.likes.viewerLiked ? "heart.fill" : "heart"} color={photo.likes.viewerLiked ? "accent" : "textPrimary"} size={size.iconTiny} />
        <Text variant="caption" weight="semibold" tabular maxFontSizeMultiplier={1.2}>
          {photo.likes.count}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  body: { gap: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tile: { borderRadius: radius.chip, overflow: "hidden", backgroundColor: colors.elevated },
  pressed: { opacity: pressedOpacity },
  likes: {
    position: "absolute",
    left: space.xxs,
    bottom: space.xxs,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xxs,
    paddingHorizontal: space.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.scrim,
  },
});
