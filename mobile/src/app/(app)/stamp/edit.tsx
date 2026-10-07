import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { api, errorText } from "@/api";
import type { Song, StampView } from "@/api/contracts";
import { useStamp } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { CAPTION_MAX, stampChanges } from "@/features/stamps/composer";
import { patchStamp } from "@/features/stamps/cache";
import { songDraft } from "@/features/stamps/song-draft";
import { SongRow } from "@/features/stamps/song-row";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { size, space } from "@/theme";

/** Edit a stamp's caption and song. The photo, the place and the time can't change. */
export default function EditStamp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stamp = useStamp(id);
  if (!stamp.data) {
    return (
      <FormScreen>
        {stamp.isError ? <InlineError message={errorText(stamp.error, "Couldn't load this stamp.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} /> : <SkeletonRows count={3} />}
      </FormScreen>
    );
  }
  return <EditForm stamp={stamp.data.stamp} />;
}

function EditForm({ stamp }: { stamp: StampView }) {
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState(stamp.caption);
  const [song, setSong] = useState<Song | null>(stamp.song);
  const [saved, setSaved] = useState(false);
  const change = stampChanges(stamp, caption, song);
  const dirty = Object.keys(change).length > 0;
  // A stamp with no photo must keep a caption or a song.
  const empty = stamp.photoUrl === null && caption.trim() === "" && song === null;
  useConfirmDiscard(dirty && !saved);

  useFocusEffect(
    useCallback(() => {
      const picked = songDraft.take();
      if (picked) setSong(picked.song);
    }, []),
  );

  const save = useMutation({
    mutationFn: () => api.stamps.edit(stamp.id, change),
    onSuccess: (res) => {
      haptics.success();
      setSaved(true);
      patchStamp(queryClient, stamp.id, () => res.stamp);
      requestAnimationFrame(() => router.back());
    },
    onError: () => haptics.warning(),
  });

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "Edit stamp",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Save" bold onPress={() => save.mutate()} disabled={!dirty || empty || save.isPending} />,
        }}
      />
      <FieldGroup footer={`${caption.length}/${CAPTION_MAX}`} errors={[empty ? "Add a caption or a song, since this stamp has no photo." : null]}>
        <Field
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          maxLength={CAPTION_MAX}
          placeholder="What's it like?"
          multiline
          inputAccessoryViewButtonLabel="Done"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />
      </FieldGroup>
      {song ? (
        <SongRow
          song={song}
          trailing={
            <Pressable onPress={() => setSong(null)} accessibilityRole="button" accessibilityLabel="Remove song" hitSlop={space.xs} style={styles.remove}>
              <Icon name="xmark.circle.fill" color="textTertiary" size={size.icon} />
            </Pressable>
          }
        />
      ) : (
        <Button title="Add a song" icon="music.note" variant="secondary" onPress={() => router.push("/stamp/song")} />
      )}
      {save.error && <InlineError message={errorText(save.error, "Couldn't save. Try again.")} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({ remove: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" } });
