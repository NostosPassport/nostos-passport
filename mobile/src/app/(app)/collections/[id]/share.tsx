import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
// Core Clipboard still works on iOS but is deprecated (dev-only warning once). Swap for expo-clipboard when it is added.
import { Alert, Clipboard, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api";
import { qk } from "@/api/keys";
import { useCollection, useCollectionShare } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Kicker, Rule } from "@/components/editorial/editorial";
import { InlineError } from "@/components/ui/inline-error";
import { ScreenState } from "@/components/ui/screen-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { colors, hairlineWidth, radius, space } from "@/theme";
import { HeaderButton, headerTextButtons } from "@/components/ui/header-button";
import { nav } from "@/lib/nav";

export default function ShareCollectionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const queryClient = useQueryClient();
  const collectionQuery = useCollection(id);
  const shareQuery = useCollectionShare(id);
  const insets = useSafeAreaInsets();

  // One share sheet at a time: taps while it is open (or presenting) are ignored (P-138).
  const sheetOpen = useRef(false);
  const openShareSheet = async (name: string, url: string) => {
    if (sheetOpen.current) return;
    sheetOpen.current = true;
    try {
      await Share.share({ title: name, message: `${name} on Nostos`, url });
    } finally {
      sheetOpen.current = false;
    }
  };
  const copyLink = (url: string) => {
    Clipboard.setString(url);
    toast.show("Link copied");
  };

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
    return <View style={styles.loading}><Stack.Screen options={{ title: "Share collection", presentation: "modal", ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} /> }) }} /><SkeletonRows count={4} /></View>;
  }
  if (failed) {
    return <View style={styles.centered}><Stack.Screen options={{ title: "Share collection", presentation: "modal", ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} /> }) }} /><ScreenState kind="error" message="Couldn't load sharing settings." retrying={collectionQuery.isFetching || shareQuery.isFetching} onRetry={() => { void collectionQuery.refetch(); void shareQuery.refetch(); }} /></View>;
  }

  const collection = collectionQuery.data.collection;
  const share = shareQuery.data.share;

  return (
    <View style={styles.scroll}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.root} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: "Share collection", presentation: "modal", ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} /> }) }} />
        <View style={styles.hero}>
          <Text variant="title" numberOfLines={3}>{collection.name}</Text>
          <Text variant="callout" color="textSecondary">Only this collection can be shared. Your master Passport always stays private.</Text>
        </View>

        <Rule />
        <View style={styles.section}>
          <Kicker>WEB LINK</Kicker>
          <Text variant="callout" color="textSecondary">
            {share.enabled
              ? "Anyone with this link can view the live collection on the web. The page is not listed or indexed by search engines."
              : "Create a private-by-link web view that works without a Nostos account."}
          </Text>
          {share.enabled ? (
            <>
              {/* The link itself, set in the typewriter on a paper slip so it reads as the thing being shared. */}
              <View style={styles.link}>
                <Text variant="typewriterSmall" numberOfLines={2} selectable>{share.url}</Text>
              </View>
              <Button title="Share link" icon="square.and.arrow.up" onPress={() => void openShareSheet(collection.name, share.url)} />
              <Button title="Copy link" icon="doc.on.doc" variant="secondary" onPress={() => copyLink(share.url)} />
            </>
          ) : (
            <Button title="Create and share link" icon="square.and.arrow.up" loading={enable.isPending} onPress={() => enable.mutate()} />
          )}
          {mutationError ? (
            <InlineError
              message="Couldn't update this shared link."
              // Retrying a disable asks again: it is destructive and the first confirmation was for that attempt (P-139).
              onRetry={share.enabled ? confirmDisable : () => enable.mutate()}
              retrying={enable.isPending || disable.isPending}
            />
          ) : null}
        </View>

        <Rule />
        <Text variant="footnote" color="textSecondary">
          Removing a stamp from this collection removes it from the shared page. Deleting the collection or disabling its link makes the shared page unavailable.
        </Text>
        {/* The destructive action sits apart from Share and Copy, at the foot of the sheet like Delete in the editor. */}
        {share.enabled ? <Button title="Disable shared link" variant="destructive" loading={disable.isPending} onPress={confirmDisable} /> : null}
      </ScrollView>
      <ToastHost bottom={insets.bottom + space.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.transparent },
  root: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  loading: { flex: 1, backgroundColor: colors.transparent, padding: space.lg },
  hero: { gap: space.xs },
  section: { gap: space.md },
  link: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.chip, backgroundColor: colors.paperDeep, borderWidth: hairlineWidth, borderColor: colors.hairline },
  centered: { flex: 1, backgroundColor: colors.transparent, justifyContent: "center" },
});
