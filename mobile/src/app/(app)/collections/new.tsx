import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { View, StyleSheet } from "react-native";

import { api } from "@/api";
import { qk } from "@/api/keys";
import { COLLECTION_COLORS } from "@/features/collections/colors";
import { CollectionEditor, type CollectionDraft } from "@/features/collections/CollectionEditor";
import { colors } from "@/theme";
import { HeaderButton, headerTextButtons } from "@/components/ui/header-button";
import { nav } from "@/lib/nav";

export default function NewCollectionScreen() {
  // "New collection" from the Add to… sheet starts with the stamps it was opened for.
  const params = useLocalSearchParams<{ stampIds?: string }>();
  const initial: CollectionDraft = { name: "", color: COLLECTION_COLORS[0]!.id, stampIds: (params.stampIds ?? "").split(",").filter(Boolean) };
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (draft: CollectionDraft) => api.collections.create(draft),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: qk.collections });
      queryClient.setQueryData(qk.collection(result.collection.id), result);
      // Close the sheet, then open the new collection as a normal push over the list, rather than replacing the
      // modal in place (P-134). Back from the new collection returns to the list.
      router.dismiss();
      nav.push({ pathname: "/collections/[id]", params: { id: result.collection.id } });
    },
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Create collection", presentation: "modal", ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} /> }) }} />
      <CollectionEditor initial={initial} submitLabel="Create" busy={mutation.isPending} error={mutation.error} onSubmit={(draft) => mutation.mutate(draft)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.transparent } });
