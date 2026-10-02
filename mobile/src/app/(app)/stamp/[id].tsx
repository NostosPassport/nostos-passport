import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { api, ApiError, errorText, mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { qk, useStamp } from "@/api/queries";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { a11yActions, showActions, useStampActions, type ContentAction } from "@/features/moderation/content-actions";
import { dropStamp } from "@/features/stamps/cache";
import { LikeButton } from "@/features/stamps/like-button";
import { SongRow } from "@/features/stamps/song-row";
import { stampLabel } from "@/features/stamps/stamp-card";
import { useLike } from "@/features/stamps/use-like";
import { formatAge } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { SOCIAL_ENABLED } from "@/config";
import { aspect, colors, screenPadding, size, space } from "@/theme";

/** A stamp: photo, caption, song, place, author, likes. Yours: Edit and Delete from profile. Others': Report and Block. */
export default function StampDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stamp = useStamp(id);
  const s = stamp.data?.stamp;
  const actions = useActions(s);
  const gone = stamp.error instanceof ApiError && (stamp.error.status === 404 || stamp.error.status === 403);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: s ? s.place.name : "Stamp",
          headerRight: () =>
            s && actions.length > 0 ? (
              <Pressable onPress={() => showActions(actions)} accessibilityRole="button" accessibilityLabel="More options" hitSlop={space.xs} style={styles.headerButton}>
                <Icon name="ellipsis.circle" color="accent" size={size.icon} />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {s ? (
          <Detail stamp={s} actions={actions} />
        ) : gone ? (
          <View style={styles.pad}>
            <Text variant="title2">This stamp isn&apos;t available</Text>
            <Text color="textSecondary">It may have been removed, or the account may be private.</Text>
            <Button title="Close" variant="secondary" compact block={false} onPress={() => router.back()} />
          </View>
        ) : stamp.isError ? (
          <View style={styles.pad}>
            <InlineError message={errorText(stamp.error, "Couldn't load this stamp.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} />
          </View>
        ) : (
          <>
            <Skeleton width="100%" height={size.postPhotoSkeleton} />
            <View style={styles.pad}>
              <Skeleton width="40%" />
              <Skeleton width="70%" />
            </View>
          </>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

function Detail({ stamp, actions }: { stamp: StampView; actions: ContentAction[] }) {
  const like = useLike();
  return (
    <>
      {stamp.photoUrl && (
        <View accessible accessibilityRole="image" accessibilityLabel={stampLabel(stamp)} {...a11yActions(actions)}>
          <Image source={{ uri: mediaUrl(stamp.photoUrl), cacheKey: stamp.id }} style={styles.photo} contentFit="cover" transition={150} accessible={false} />
        </View>
      )}
      <View style={styles.pad}>
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
              <Text variant="headline">{stamp.author.displayName}</Text>
              {stamp.author.verified && <VerifiedBadge accessible={false} />}
            </View>
            <Text variant="subhead" color="textSecondary">
              @{stamp.author.handle} · at {stamp.place.name}
            </Text>
          </View>
        </Pressable>

        {stamp.caption !== "" && <Text variant="body">{stamp.caption}</Text>}
        {stamp.song && <SongRow song={stamp.song} />}

        <View style={styles.footer}>
          {SOCIAL_ENABLED && <LikeButton likes={stamp.likes} disabled={stamp.mine} onPress={() => like.toggle(stamp.id, stamp.likes)} />}
          <Text variant="footnote" color="textTertiary">
            {formatAge(stamp.createdAt)}
            {stamp.editedAt ? " · Edited" : ""}
          </Text>
        </View>
        {stamp.mine && (
          <Text variant="footnote" color="textTertiary">
            Only people who can see your passport can see this stamp.
          </Text>
        )}
      </View>
    </>
  );
}

/** Yours: Edit and Delete from profile (hides it for good). Others': Report and Block. */
function useActions(stamp: StampView | undefined): ContentAction[] {
  const build = useStampActions();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.stamps.remove(id),
    onSuccess: (_r, id) => {
      haptics.success();
      toast.show("Deleted from your profile.");
      dropStamp(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: qk.feed });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      router.back();
    },
    onError: (e) => {
      haptics.warning();
      toast.show(errorText(e, "Couldn't delete that. Try again."), "neutral");
    },
  });
  if (!stamp) return [];
  const extra: ContentAction[] = stamp.mine
    ? [
        { label: "Edit", onPress: () => router.push({ pathname: "/stamp/edit", params: { id: stamp.id } }) },
        {
          label: "Delete from profile",
          destructive: true,
          onPress: () =>
            Alert.alert("Delete from your profile?", "It's removed from your passport and everyone's feed for good.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate(stamp.id) },
            ]),
        },
      ]
    : [];
  return build({ id: stamp.id, authorHandle: stamp.author.handle, mine: stamp.mine, extra });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxxl },
  photo: { width: "100%", aspectRatio: aspect.post, backgroundColor: colors.elevated },
  pad: { paddingHorizontal: screenPadding, paddingTop: space.md, gap: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget },
  names: { flex: 1, gap: space.xxs },
  handleRow: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md },
  headerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
});
