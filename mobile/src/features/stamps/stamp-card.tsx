import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { a11yActions, showActions, useStampActions } from "@/features/moderation/content-actions";
import { formatAge } from "@/lib/format";
import { aspect, colors, pressedOpacity, screenPadding, size, space } from "@/theme";
import { LikeButton } from "./like-button";
import { SongRow, songLabel } from "./song-row";
import { useLike } from "./use-like";

/** Spoken summary of a stamp: "Stamp by @sam at The Place: caption. Song: ... 3 likes". */
export function stampLabel(s: StampView): string {
  return [`Stamp by @${s.author.handle}${s.author.verified ? ", verified" : ""} at ${s.place.name}`, s.caption || null, s.song ? songLabel(s.song) : null, s.photoUrl ? "with a photo" : null]
    .filter(Boolean)
    .join(". ");
}

/**
 * One stamp in the feed: who stamped where and when, the photo (if any), the caption, the song, and the like button.
 * Opens the stamp. The author is always a full profile view, because a stamp only reaches people who may see it.
 */
export const StampCard = memo(function StampCard({ stamp }: { stamp: StampView }) {
  const like = useLike();
  const build = useStampActions();
  const actions = build({ id: stamp.id, authorHandle: stamp.author.handle, mine: stamp.mine });
  const open = () => router.push({ pathname: "/stamp/[id]", params: { id: stamp.id } });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: stamp.author.handle } })}
          accessibilityRole="button"
          accessibilityLabel={`@${stamp.author.handle}${stamp.author.verified ? ", verified" : ""}`}
          accessibilityHint="Opens their passport"
          style={styles.who}
        >
          <Avatar name={stamp.author.displayName} uri={stamp.author.avatarUrl} />
          <View style={styles.names}>
            <View style={styles.handleRow}>
              <Text variant="subhead" weight="semibold" numberOfLines={1} style={styles.shrink}>
                {stamp.author.displayName}
              </Text>
              {stamp.author.verified && <VerifiedBadge accessible={false} />}
            </View>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {stamp.place.name} · {formatAge(stamp.createdAt)}
            </Text>
          </View>
        </Pressable>
        {actions.length > 0 && (
          <Pressable onPress={() => showActions(actions)} accessibilityRole="button" accessibilityLabel="More options" hitSlop={space.xs} style={styles.more}>
            <Icon name="ellipsis" color="textSecondary" size={size.icon} />
          </Pressable>
        )}
      </View>

      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={stampLabel(stamp)} accessibilityHint="Opens the stamp" {...a11yActions(actions)} style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        {stamp.photoUrl && <Image source={{ uri: mediaUrl(stamp.photoUrl), cacheKey: stamp.id }} style={styles.photo} contentFit="cover" transition={150} recyclingKey={stamp.id} accessible={false} />}
        {stamp.caption !== "" && (
          <Text variant="body" style={styles.caption}>
            {stamp.caption}
          </Text>
        )}
        {stamp.song && (
          <View style={styles.song}>
            <SongRow song={stamp.song} />
          </View>
        )}
      </Pressable>

      <View style={styles.footer}>
        <LikeButton likes={stamp.likes} disabled={stamp.mine} onPress={() => like.toggle(stamp.id, stamp.likes)} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: space.xs, paddingVertical: space.sm },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: screenPadding },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget },
  names: { flex: 1, gap: space.xxs },
  handleRow: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  shrink: { flexShrink: 1 },
  more: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
  body: { gap: space.xs },
  pressed: { opacity: pressedOpacity },
  photo: { width: "100%", aspectRatio: aspect.post, backgroundColor: colors.elevated },
  caption: { paddingHorizontal: screenPadding },
  song: { paddingHorizontal: screenPadding },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: screenPadding },
});
