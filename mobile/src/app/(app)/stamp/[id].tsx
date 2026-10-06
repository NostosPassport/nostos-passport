import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text as NativeText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError, errorText, mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { qk, usePins, useStamp } from "@/api/queries";
import { EditorialButton, Kicker } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { pinChange } from "@/features/book/pin-change";
import { a11yActions, showActions, useStampActions, type ContentAction } from "@/features/moderation/content-actions";
import { dropStamp } from "@/features/stamps/cache";
import { LikeButton } from "@/features/stamps/like-button";
import { SongRow } from "@/features/stamps/song-row";
import { useLike } from "@/features/stamps/use-like";
import { SOCIAL_ENABLED } from "@/config";
import { haptics } from "@/lib/haptics";
import { colors, fonts, screenPadding, size, space } from "@/theme";

export default function StampDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stamp = useStamp(id);
  const s = stamp.data?.stamp;
  const actions = useActions(s);
  const gone = stamp.error instanceof ApiError && (stamp.error.status === 404 || stamp.error.status === 403);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {s ? (
        <Memory stamp={s} actions={actions} />
      ) : gone ? (
        <View style={styles.centerState}>
          <Text variant="title2">This memory isn&apos;t available</Text>
          <Text color="textSecondary">It may have been removed, or the account may be private.</Text>
          <Button title="Close" variant="secondary" compact block={false} onPress={() => router.back()} />
        </View>
      ) : stamp.isError ? (
        <View style={styles.centerState}>
          <InlineError message={errorText(stamp.error, "Couldn't load this memory.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} />
        </View>
      ) : (
        <View style={styles.centerState}>
          <Skeleton width="100%" height={size.postPhotoSkeleton} />
        </View>
      )}
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

function Memory({ stamp, actions }: { stamp: StampView; actions: ContentAction[] }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activePhoto, setActivePhoto] = useState(0);
  const like = useLike();
  const pins = usePins();
  const pinned = pins.data?.stamps.some((p) => p.id === stamp.id) ?? false;
  const pinAction = actions.find((action) => action.label === "Pin to passport" || action.label === "Unpin from passport");
  const date = new Date(stamp.createdAt);
  const dateLabel = date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const memoryNumber = stamp.page !== null && stamp.slot !== null ? (stamp.page - 1) * 3 + stamp.slot : 1;
  const number = String(memoryNumber).padStart(3, "0");
  const photoWidth = Math.max(1, width - 48);

  return (
    <ScrollView contentContainerStyle={[styles.memory, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 20 }]} {...a11yActions(actions)}>
      <View style={styles.memoryTopbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.hitTarget}>
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Pressable>
        <Pressable onPress={() => showActions(actions)} accessibilityRole="button" accessibilityLabel="More options" style={styles.hitTarget}>
          <NativeText style={styles.more}>•••</NativeText>
        </Pressable>
      </View>
      <Kicker>NO. {number} / {dateLabel}</Kicker>
      <NativeText style={styles.memoryTitle}>{stamp.place.name}</NativeText>
      <Kicker>{stamp.place.neighborhood}, NEW YORK</Kicker>

      <View style={styles.heroFrame}>
        {stamp.photos.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={stamp.photos.length > 1}
            onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}
          >
            {stamp.photos.map((photo, index) => (
              <View key={photo.id} style={[styles.photoPage, { width: photoWidth }]}>
                <Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityLabel={`Photo ${index + 1} of ${stamp.photos.length}`} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyPhoto} />
        )}
        <View style={styles.travelStamp} pointerEvents="none">
          <Kicker>BEEN HERE</Kicker>
          <NativeText style={styles.stampCity}>NYC</NativeText>
          <Icon name="seal" color="accent" size={34} />
          <NativeText style={styles.stampFooter}>RETURN / REMEMBER</NativeText>
        </View>
      </View>

      {stamp.caption ? <NativeText style={styles.caption}>{stamp.caption}</NativeText> : null}
      {stamp.song ? <SongRow song={stamp.song} /> : null}

      <View style={styles.photoMeta}>
        <Kicker>{stamp.photos.length === 0 ? "NO PHOTOS" : `${activePhoto + 1} OF ${stamp.photos.length} ${stamp.photos.length === 1 ? "PHOTO" : "PHOTOS"}`}</Kicker>
        <View style={styles.dots}>
          {stamp.photos.slice(0, 6).map((photo, index) => <View key={photo.id} style={[styles.dot, index === activePhoto && styles.dotActive]} />)}
        </View>
      </View>
      {stamp.mine ? <EditorialButton label={pinned ? "Pinned to passport" : "Pin to passport"} outline onPress={() => pinAction?.onPress()} /> : null}
      {SOCIAL_ENABLED ? <LikeButton likes={stamp.likes} disabled={stamp.mine} onPress={() => like.toggle(stamp.id, stamp.likes)} /> : null}
    </ScrollView>
  );
}

function useActions(stamp: StampView | undefined): ContentAction[] {
  const build = useStampActions();
  const queryClient = useQueryClient();
  const pins = usePins();
  const setPins = useMutation({
    mutationFn: (ids: string[]) => api.pins.set(ids),
    onSuccess: (r) => {
      haptics.success();
      queryClient.setQueryData(qk.pins, r);
      toast.show("Updated your pinned stamps.");
    },
    onError: (e) => {
      haptics.warning();
      toast.show(errorText(e, "Couldn't change that. Try again."), "neutral");
    },
  });
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
        {
          label: pins.data?.stamps.some((p) => p.id === stamp.id) ? "Unpin from passport" : "Pin to passport",
          onPress: () => {
            const change = pinChange((pins.data?.stamps ?? []).map((p) => p.id), stamp.id);
            if (change.kind === "full") Alert.alert("Four stamps are pinned", "Unpin one first, then pin this one.");
            else setPins.mutate(change.ids);
          },
        },
        { label: "Edit", onPress: () => router.push({ pathname: "/stamp/edit", params: { id: stamp.id } }) },
        {
          label: "Delete from profile",
          destructive: true,
          onPress: () => Alert.alert("Delete from your profile?", "It's removed from your passport and everyone's feed for good.", [
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
  centerState: { flex: 1, paddingHorizontal: screenPadding, alignItems: "center", justifyContent: "center", gap: space.md },
  memory: { paddingHorizontal: 24, gap: 10 },
  memoryTopbar: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -7 },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  more: { color: colors.textPrimary, fontSize: 19, letterSpacing: 2 },
  memoryTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 64, lineHeight: 64, letterSpacing: -1.6, paddingTop: 2 },
  heroFrame: { height: 301, marginTop: 4, overflow: "hidden", backgroundColor: colors.elevated, position: "relative" },
  photoPage: { height: 301, backgroundColor: colors.elevated },
  emptyPhoto: { flex: 1, backgroundColor: colors.elevated },
  travelStamp: { position: "absolute", right: 8, top: 16, width: 88, height: 100, backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, alignItems: "center", justifyContent: "space-around", paddingVertical: 5, transform: [{ rotate: "4deg" }] },
  stampCity: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 17, lineHeight: 18 },
  stampFooter: { color: colors.accent, fontFamily: fonts.monoBold, fontSize: 6, letterSpacing: 1.1 },
  caption: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 44, lineHeight: 44, letterSpacing: -1.1, marginVertical: 4, paddingTop: 2 },
  photoMeta: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.textTertiary, opacity: 0.45 },
  dotActive: { backgroundColor: colors.accent, opacity: 1 },
});
