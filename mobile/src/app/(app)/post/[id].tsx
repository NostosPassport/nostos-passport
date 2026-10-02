import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { api, ApiError, errorText, mediaUrl } from "@/api";
import type { PostView } from "@/api/contracts";
import { qk, useMe, usePost } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { a11yActions, showActions, useContentActions, type ContentAction } from "@/features/moderation/content-actions";
import { AuthorLine, authorSpoken } from "@/features/people/author-line";
import { DoubleTapToLike, LikeButton } from "@/features/posts/like-button";
import { ratingEditable } from "@/features/posts/post-edit";
import { useLike } from "@/features/posts/use-like";
import { formatAge } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { aspect, colors, screenPadding, size, space } from "@/theme";

/** A post: photo, author (as the server resolved it for you), venue, rating, caption and likes. */
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);
  const p = post.data?.post;
  const actions = usePostActions(p);
  const gone = post.error instanceof ApiError && (post.error.status === 404 || post.error.status === 403);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: () =>
            p && actions.length > 0 ? (
              <Pressable onPress={() => showActions(actions)} accessibilityRole="button" accessibilityLabel="More options" hitSlop={space.xs} style={styles.headerButton}>
                <Icon name="ellipsis.circle" color="accent" size={size.icon} />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {p ? (
          <Post post={p} actions={actions} />
        ) : gone ? (
          <View style={styles.pad}>
            <Text variant="title2">This post isn&apos;t available</Text>
            <Text color="textSecondary">It may have been removed.</Text>
            <Button title="Close" variant="secondary" compact block={false} onPress={() => router.back()} />
          </View>
        ) : post.isError ? (
          <View style={styles.pad}>
            <InlineError message={errorText(post.error, "Couldn't load this post.")} onRetry={() => void post.refetch()} retrying={post.isFetching} />
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

function Post({ post, actions }: { post: PostView; actions: ContentAction[] }) {
  const like = useLike();
  const canLike = !!post.likes && !post.mine;
  const editableRating = ratingEditable(post);
  const spoken = [`Photo at ${post.venue.name}`, `by ${authorSpoken(post.author)}`, `rated ${post.rating} of 10`, post.caption || null].filter(Boolean).join(", ");

  return (
    <>
      <DoubleTapToLike enabled={canLike} onDoubleTap={() => post.likes && like.toggle(post.id, post.likes, true)}>
        <View accessible accessibilityRole="image" accessibilityLabel={spoken} {...a11yActions(actions)}>
          <Image source={{ uri: mediaUrl(post.url), cacheKey: post.id }} style={styles.photo} contentFit="cover" transition={150} accessible={false} />
        </View>
      </DoubleTapToLike>
      <View style={styles.pad}>
        <View style={styles.meta}>
          <View style={styles.who}>
            <AuthorLine author={post.author} variant="headline" />
            <Pressable
              onPress={() => router.push({ pathname: "/venue/[id]", params: { id: post.venue.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`At ${post.venue.name}`}
              accessibilityHint="Opens the venue"
              hitSlop={space.xs}
            >
              <Text variant="subhead" color="textSecondary">
                at <Text variant="subhead" color="textPrimary" weight="semibold">{post.venue.name}</Text>
              </Text>
            </Pressable>
          </View>
          <View style={styles.rating} accessible accessibilityLabel={`Rated ${post.rating} of 10`}>
            <Text variant="title" tabular>
              {post.rating}
            </Text>
            <Text variant="footnote" color="textTertiary">
              /10
            </Text>
          </View>
        </View>

        {post.caption !== "" && <Text variant="body">{post.caption}</Text>}

        <View style={styles.footer}>
          {post.likes && <LikeButton likes={post.likes} disabled={!canLike} onPress={() => post.likes && like.toggle(post.id, post.likes)} />}
          <Text variant="footnote" color="textTertiary">
            {formatAge(post.createdAt)}
            {post.editedAt ? " · Edited" : ""}
          </Text>
        </View>

        {post.mine && (
          <Text variant="footnote" color="textTertiary">
            {post.shared ? "Shared to the venue page." : "Only on your profile."}
            {editableRating ? " You can change the rating until 5 am." : ""}
          </Text>
        )}
      </View>
    </>
  );
}

/** Yours: Edit and Delete from profile (hides it for good). Others': Report and Block. */
function usePostActions(post: PostView | undefined): ContentAction[] {
  const build = useContentActions();
  const queryClient = useQueryClient();
  const me = useMe();
  const remove = useMutation({
    mutationFn: (id: string) => api.posts.remove(id),
    onSuccess: (_r, id) => {
      haptics.success();
      toast.show("Deleted from your profile.");
      queryClient.removeQueries({ queryKey: qk.post(id) });
      const handle = me.data?.user.handle;
      if (handle) void queryClient.invalidateQueries({ queryKey: qk.user(handle) });
      void queryClient.invalidateQueries({ queryKey: ["venue"] });
      void queryClient.invalidateQueries({ queryKey: ["featured"] });
      router.back();
    },
    onError: (e) => {
      haptics.warning();
      toast.show(errorText(e, "Couldn't delete that. Try again."), "neutral");
    },
  });
  if (!post) return [];
  if (!post.mine) return build({ targetType: "PHOTO", id: post.id, author: post.author, mine: false });
  return [
    { label: "Edit", onPress: () => router.push({ pathname: "/post/edit", params: { id: post.id } }) },
    {
      label: "Delete from profile",
      destructive: true,
      onPress: () =>
        Alert.alert("Delete from your profile?", "It's removed from your profile and the venue page for good.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => remove.mutate(post.id) },
        ]),
    },
  ];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxxl },
  photo: { width: "100%", aspectRatio: aspect.post, backgroundColor: colors.elevated },
  pad: { paddingHorizontal: screenPadding, paddingTop: space.md, gap: space.md },
  meta: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  who: { flex: 1, gap: space.xxs },
  rating: { flexDirection: "row", alignItems: "baseline", gap: space.xxs },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md },
  headerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
});
