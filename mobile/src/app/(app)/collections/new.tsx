import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { View, StyleSheet } from "react-native";

import { api } from "@/api";
import { qk } from "@/api/keys";
import { CollectionEditor, type CollectionDraft } from "@/features/collections/CollectionEditor";
import { colors } from "@/theme";

const initial: CollectionDraft = { name: "", color: "blue", stampIds: [] };

export default function NewCollectionScreen() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (draft: CollectionDraft) => api.collections.create(draft),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: qk.collections });
      queryClient.setQueryData(qk.collection(result.collection.id), result);
      router.replace({ pathname: "/collections/[id]", params: { id: result.collection.id } });
    },
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Create collection", presentation: "modal" }} />
      <CollectionEditor initial={initial} submitLabel="Create collection" busy={mutation.isPending} error={mutation.error} onSubmit={(draft) => mutation.mutate(draft)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });
