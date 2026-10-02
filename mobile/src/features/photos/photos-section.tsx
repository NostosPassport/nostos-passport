import { Image } from "expo-image";
import { authorSpoken } from "@/features/people/author-line";
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { mediaUrl } from "@/api";
import type { PhotoView } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { a11yActions, showActions, useContentActions, type ContentAction } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { formatAge, plural } from "@/lib/format";
import { colors, pressedOpacity, radius, size, space } from "@/theme";
import { uploadStore, type PendingUpload } from "./upload-store";

const COLUMNS = 3;

type Props = {
  venueId: string;
  live: PhotoView[];
  earlier: PhotoView[];
  pending: PendingUpload[];
  serverNow: string;
  canPost: boolean;
  onTakePhoto: () => void;
  onRetryUpload: (localId: string) => void;
};

export function PhotosSection({ venueId, live, earlier, pending, serverNow, canPost, onTakePhoto, onRetryUpload }: Props) {
  const [width, setWidth] = useState(0);
  const [showEarlier, setShowEarlier] = useState(false);
  const buildActions = useContentActions();
  const flagged = useFlaggedIds();
  const tile = width > 0 ? (width - space.xs * (COLUMNS - 1)) / COLUMNS : 0;
  const serverIds = new Set(live.map((p) => p.id));
  const shownLive = live.filter((p) => !flagged.has(p.id));
  const shownEarlier = earlier.filter((p) => !flagged.has(p.id));
  // Optimistic tiles until the refetched page includes the photo.
  const shownPending = pending.filter((u) => !(u.result && serverIds.has(u.result.id)));

  const open = (set: "live" | "earlier", photoId: string) => router.push({ pathname: "/venue/photos", params: { id: venueId, set, photoId } });
  const actionsFor = (p: PhotoView) => buildActions({ targetType: "PHOTO", id: p.id, author: p.author, mine: p.mine });

  return (
    <Section
      title="Photos"
      accessory={
        <Text variant="footnote" color="textTertiary">
          Last 3 hours
        </Text>
      }
    >
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {shownLive.length === 0 && shownPending.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="callout" color="textSecondary">
              No live photos yet.
            </Text>
            {canPost && <Button title="Post the first one" icon="camera.fill" variant="secondary" compact block={false} onPress={onTakePhoto} />}
          </View>
        ) : (
          tile > 0 && (
            <View style={styles.grid}>
              {shownPending.map((u) => (
                <PendingTile key={u.localId} upload={u} size={tile} onRetry={() => onRetryUpload(u.localId)} />
              ))}
              {shownLive.map((p) => (
                <PhotoTile key={p.id} photo={p} size={tile} serverNow={serverNow} onPress={() => open("live", p.id)} actions={actionsFor(p)} />
              ))}
            </View>
          )
        )}
      </View>

      {shownEarlier.length > 0 && (
        <View style={styles.earlier}>
          <Pressable
            onPress={() => setShowEarlier((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showEarlier }}
            accessibilityLabel={`Earlier, not live, ${plural(shownEarlier.length, "photo")}`}
            style={styles.earlierHeader}
          >
            <Text variant="headline">Earlier</Text>
            <Text variant="footnote" color="textTertiary" style={styles.flex}>
              Not live · {plural(shownEarlier.length, "photo")}
            </Text>
            <Icon name={showEarlier ? "chevron.up" : "chevron.down"} color="textTertiary" size={size.iconTiny} />
          </Pressable>
          {showEarlier && tile > 0 && (
            <View style={styles.grid}>
              {shownEarlier.map((p) => (
                <PhotoTile key={p.id} photo={p} size={tile} serverNow={serverNow} faded onPress={() => open("earlier", p.id)} actions={actionsFor(p)} />
              ))}
            </View>
          )}
        </View>
      )}
    </Section>
  );
}

type TileProps = { photo: PhotoView; size: number; serverNow: string; faded?: boolean; onPress: () => void; actions: ContentAction[] };

const PhotoTile = memo(function PhotoTile({ photo, size: s, serverNow, faded, onPress, actions }: TileProps) {
  const who = authorSpoken(photo.author);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={actions.length ? () => showActions(actions) : undefined}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo by ${who}, ${formatAge(photo.createdAt, serverNow)}${photo.rating ? `, rated ${photo.rating} of 10` : ""}${photo.likes ? `, ${plural(photo.likes.count, "like")}` : ""}${photo.caption ? `: ${photo.caption}` : ""}`}
      accessibilityHint="Opens the photo"
      {...a11yActions(actions)}
      style={({ pressed }) => [styles.tile, { width: s, height: s }, pressed && styles.pressed]}
    >
      {/* Signed URLs change every few minutes; cache by photo id so refetches don't re-download. */}
      <Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={[StyleSheet.absoluteFill, faded && styles.faded]} contentFit="cover" transition={150} recyclingKey={photo.id} cachePolicy="memory-disk" />
    </Pressable>
  );
});

function PendingTile({ upload, size: s, onRetry }: { upload: PendingUpload; size: number; onRetry: () => void }) {
  const failed = upload.status === "failed";
  // Keep showing the local file after it posts: no flash while the remote copy loads.
  const uri = upload.uri;
  return (
    <View
      style={[styles.tile, { width: s, height: s }]}
      accessible
      accessibilityLabel={failed ? `Upload failed. ${upload.error ?? ""}` : upload.status === "done" ? "Your photo, posted" : `Uploading your photo, ${Math.round(upload.progress * 100)} percent`}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      {upload.status !== "done" && (
        <View style={styles.overlay}>
          {failed ? (
            <View style={styles.failed}>
              <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry upload" hitSlop={space.xs} style={styles.overlayButton}>
                <Icon name="arrow.clockwise" color="textPrimary" size={size.icon} />
              </Pressable>
              <Pressable onPress={() => uploadStore.remove(upload.localId)} accessibilityRole="button" accessibilityLabel="Remove" hitSlop={space.xs} style={styles.overlayButton}>
                <Icon name="xmark" color="textPrimary" size={size.icon} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(4, upload.progress * 100)}%` }]} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tile: { borderRadius: radius.chip, overflow: "hidden", backgroundColor: colors.elevated },
  pressed: { opacity: pressedOpacity },
  faded: { opacity: 0.7 },
  empty: { gap: space.sm, alignItems: "flex-start" },
  earlier: { gap: space.sm },
  earlierHeader: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: size.hitTarget },
  flex: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim, justifyContent: "flex-end", padding: space.xs },
  failed: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  overlayButton: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: space.xxs, borderRadius: radius.pill, backgroundColor: colors.hairline, overflow: "hidden" },
  progressFill: { height: space.xxs, backgroundColor: colors.accent },
});
