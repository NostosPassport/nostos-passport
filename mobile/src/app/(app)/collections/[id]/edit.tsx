import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { api } from "@/api";
import { qk } from "@/api/keys";
import { useCollection } from "@/api/queries";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { CollectionEditor, type CollectionDraft } from "@/features/collections/CollectionEditor";
import { colors, space } from "@/theme";

export default function EditCollectionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const queryClient = useQueryClient();
  const query = useCollection(id);
  const update = useMutation({
    mutationFn: (draft: CollectionDraft) => api.collections.update(id, draft),
    onSuccess: (result) => {
      queryClient.setQueryData(qk.collection(id), result);
      void queryClient.invalidateQueries({ queryKey: qk.collections });
      router.back();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.collections.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: qk.collection(id) });
      void queryClient.invalidateQueries({ queryKey: qk.collections });
      router.replace("/collections");
    },
  });

  const confirmDelete = () => Alert.alert("Delete collection?", "The collection will be removed, but every stamp will stay in your master Passport.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
  ]);

  if (query.isPending) return <View style={styles.loading}><Stack.Screen options={{ title: "Edit collection" }} /><SkeletonRows count={5} /></View>;
  if (query.isError || !query.data) return <View style={styles.loading}><Stack.Screen options={{ title: "Edit collection" }} /><InlineError message="Couldn't open this collection." onRetry={() => void query.refetch()} /></View>;

  const collection = query.data.collection;
  const initial: CollectionDraft = { name: collection.name, color: collection.color, stampIds: collection.stamps.map((stamp) => stamp.id) };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Edit collection", presentation: "modal" }} />
      <CollectionEditor
        initial={initial}
        submitLabel="Save changes"
        busy={update.isPending}
        error={update.error ?? remove.error}
        onSubmit={(draft) => update.mutate(draft)}
        onDelete={confirmDelete}
        deleting={remove.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
  loading: { flex: 1, backgroundColor: colors.transparent, padding: space.lg },
});
