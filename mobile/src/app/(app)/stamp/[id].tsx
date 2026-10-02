import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { api, ApiError, errorText } from "@/api";
import type { StampView } from "@/api/contracts";
import { qk, usePins, useStamp } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { a11yActions, showActions, useStampActions, type ContentAction } from "@/features/moderation/content-actions";
import { dropStamp } from "@/features/stamps/cache";
import { LikeButton } from "@/features/stamps/like-button";
import { useLike } from "@/features/stamps/use-like";
import { formatAge } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { SOCIAL_ENABLED } from "@/config";
import { pinChange } from "@/features/book/pin-change";
import { VisaSpread } from "@/features/book/VisaSpread";
import { colors, screenPadding, size, space } from "@/theme";

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
    <View {...a11yActions(actions)}>
      <VisaSpread stamp={stamp} />
      <View style={styles.pad}>
        <View style={styles.footer}>
          {SOCIAL_ENABLED && <LikeButton likes={stamp.likes} disabled={stamp.mine} onPress={() => like.toggle(stamp.id, stamp.likes)} />}
          <Text variant="footnote" color="textTertiary">
            {formatAge(stamp.createdAt)}
          </Text>
        </View>
        {stamp.mine && (
          <Text variant="footnote" color="textTertiary">
            Only you can see this stamp.
          </Text>
        )}
      </View>
    </View>
  );
}

/** Yours: Edit and Delete from profile (hides it for good). Others': Report and Block. */
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
  pad: { paddingHorizontal: screenPadding, paddingTop: space.md, gap: space.md },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md },
  headerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
});
