import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { api, errorText } from "@/api";
import type { PostView } from "@/api/contracts";
import { qk, useMe, usePost } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { RatingPicker } from "@/components/ui/rating-picker";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { CAPTION_MAX, postChanges, ratingEditable, type PostValues } from "@/features/posts/post-edit";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, radius, size, space } from "@/theme";

/** Edit your post: the rating (until the end of its night), the caption and sharing. */
export default function EditPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);
  const p = post.data?.post;
  if (p && !p.mine)
    return (
      <FormScreen>
        <Text color="textSecondary">You can only edit your own posts.</Text>
      </FormScreen>
    );
  if (!p)
    return (
      <FormScreen>
        {post.isError ? (
          <InlineError message={errorText(post.error, "Couldn't load this post.")} onRetry={() => void post.refetch()} retrying={post.isFetching} />
        ) : (
          <SkeletonRows count={3} />
        )}
      </FormScreen>
    );
  return <EditForm post={p} />;
}

function EditForm({ post }: { post: PostView }) {
  const queryClient = useQueryClient();
  const me = useMe();
  const initial: PostValues = { rating: post.rating, caption: post.caption, shared: post.shared };
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const canEditRating = ratingEditable(post);
  const change = postChanges(initial, values, canEditRating);
  const dirty = Object.keys(change).length > 0;
  useConfirmDiscard(dirty && !saved);

  const save = useMutation({
    mutationFn: () => api.posts.edit(post.id, change),
    onSuccess: () => {
      haptics.success();
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: qk.post(post.id) });
      const handle = me.data?.user.handle;
      if (handle) void queryClient.invalidateQueries({ queryKey: qk.user(handle) });
      void queryClient.invalidateQueries({ queryKey: ["venue"] });
      void queryClient.invalidateQueries({ queryKey: ["featured"] });
      requestAnimationFrame(() => router.back());
    },
    onError: () => haptics.warning(),
  });

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Save" bold onPress={() => save.mutate()} disabled={!dirty || save.isPending} />,
        }}
      />
      <View style={styles.block}>
        <Text variant="footnote" color="textSecondary" weight="semibold" style={styles.label}>
          Rating
        </Text>
        <RatingPicker value={values.rating} onChange={(rating) => setValues((v) => ({ ...v, rating }))} disabled={!canEditRating} />
        <Text variant="footnote" color="textTertiary" style={styles.label}>
          {canEditRating ? "You can change the rating until 5 am." : "The rating locked at the end of that night."}
        </Text>
      </View>

      <FieldGroup footer={`${values.caption.trim().length}/${CAPTION_MAX}`}>
        <Field label="Caption" value={values.caption} onChangeText={(caption) => setValues((v) => ({ ...v, caption }))} maxLength={CAPTION_MAX} placeholder="Optional" multiline />
      </FieldGroup>

      <View style={styles.block}>
        <View style={styles.switchRow}>
          <Text variant="body" style={styles.flex}>
            Share to venue page
          </Text>
          <Switch
            value={values.shared}
            onValueChange={(shared) => setValues((v) => ({ ...v, shared }))}
            trackColor={{ true: colors.accent, false: colors.elevated }}
            accessibilityLabel="Share to venue page"
          />
        </View>
        <Text variant="footnote" color="textTertiary" style={styles.label}>
          {values.shared ? "Shows in the venue's photos and can be liked and featured." : "Only on your profile."}
        </Text>
      </View>

      {save.error && <InlineError message={errorText(save.error, "Couldn't save. Try again.")} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  label: { paddingHorizontal: space.md },
  switchRow: { flexDirection: "row", alignItems: "center", minHeight: size.fieldHeight, paddingHorizontal: space.md, backgroundColor: colors.surface, borderRadius: radius.card },
  flex: { flex: 1 },
});
