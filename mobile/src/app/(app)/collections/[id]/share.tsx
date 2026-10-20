import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Alert, Share, StyleSheet, View } from "react-native";

import { api } from "@/api";
import { qk } from "@/api/keys";
import { useCollection, useCollectionShare } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { colors, hairlineWidth, space } from "@/theme";

async function openShareSheet(name: string, url: string) {
  await Share.share({ title: name, message: `${name} on Nostos`, url });
}

export default function ShareCollectionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const queryClient = useQueryClient();
  const collectionQuery = useCollection(id);
  const shareQuery = useCollectionShare(id);

  const enable = useMutation({
    mutationFn: () => api.collections.enableShare(id),
    onSuccess: async (result) => {
      queryClient.setQueryData(qk.collectionShare(id), result);
      if (result.share.enabled && collectionQuery.data) {
        await openShareSheet(collectionQuery.data.collection.name, result.share.url);
      }
    },
  });
  const disable = useMutation({
    mutationFn: () => api.collections.disableShare(id),
    onSuccess: (result) => queryClient.setQueryData(qk.collectionShare(id), result),
  });

  const confirmDisable = () => Alert.alert(
    "Disable shared link?",
    "Anyone using the current link will stop being able to view this collection. You can create a new link later.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: () => disable.mutate() },
    ],
  );

  const busy = collectionQuery.isPending || shareQuery.isPending;
  const failed = collectionQuery.isError || shareQuery.isError || !collectionQuery.data || !shareQuery.data;
  const mutationError = enable.error ?? disable.error;

  if (busy) {
    return <View style={styles.loading}><Stack.Screen options={{ title: "Share collection", presentation: "modal" }} /><SkeletonRows count={4} /></View>;
  }
  if (failed) {
    return <View style={styles.loading}><Stack.Screen options={{ title: "Share collection", presentation: "modal" }} /><InlineError message="Couldn't load sharing settings." onRetry={() => { void collectionQuery.refetch(); void shareQuery.refetch(); }} /></View>;
  }

  const collection = collectionQuery.data.collection;
  const share = shareQuery.data.share;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Share collection", presentation: "modal" }} />
      <View style={styles.hero}>
        <Text variant="title1">{collection.name}</Text>
        <Text color="textSecondary">Only this collection can be shared. Your master Passport always stays private.</Text>
      </View>

      <View style={styles.card}>
        <Text variant="title3">Web link</Text>
        <Text color="textSecondary">
          {share.enabled
            ? "Anyone with this link can view the live collection on the web. The page is not listed or indexed by search engines."
            : "Create a private-by-link web view that works without a Nostos account."}
        </Text>
        {share.enabled ? (
          <>
            <Text variant="caption" color="textSecondary" numberOfLines={2} selectable>{share.url}</Text>
            <Button title="Share link" icon="square.and.arrow.up" onPress={() => void openShareSheet(collection.name, share.url)} />
            <Button title="Disable shared link" variant="destructive" loading={disable.isPending} onPress={confirmDisable} />
          </>
        ) : (
          <Button title="Create and share link" icon="square.and.arrow.up" loading={enable.isPending} onPress={() => enable.mutate()} />
        )}
        {mutationError ? <InlineError message="Couldn't update this shared link." onRetry={share.enabled ? () => disable.reset() : () => enable.reset()} /> : null}
      </View>

      <Text variant="caption" color="textSecondary">
        Removing a stamp from this collection removes it from the shared page. Deleting the collection or disabling its link makes the shared page unavailable.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: space.lg, gap: space.lg },
  loading: { flex: 1, backgroundColor: colors.background, padding: space.lg },
  hero: { gap: space.xs },
  card: { borderTopWidth: hairlineWidth, borderBottomWidth: hairlineWidth, borderColor: colors.hairline, paddingVertical: space.lg, gap: space.md },
});
