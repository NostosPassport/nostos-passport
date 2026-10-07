import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CAMERA_NOTE, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { MAX_STAMP_PHOTOS, photoCount } from "@/features/stamps/stamp-flow";
import { haptics } from "@/lib/haptics";
import { colors, radius, screenPadding, size, space } from "@/theme";

export default function StampCamera() {
  const insets = useSafeAreaInsets();
  const photos = usePhotoDraft();
  const initialPhotoCount = useRef(photoDraft.get().length);
  const openedInitialCamera = useRef(false);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const full = photos.length >= MAX_STAMP_PHOTOS;

  const capture = useCallback(async (initial = false) => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return;
    busyRef.current = true;
    setBusy(true);
    setNote(null);

    try {
      const outcome = await takePhoto();
      if (outcome === "cancelled") {
        if (initial && initialPhotoCount.current === 0) router.back();
        return;
      }
      if (typeof outcome === "string") {
        setNote(CAMERA_NOTE[outcome]);
        return;
      }

      const prepared = await prepareImage(outcome.uri);
      if (photoDraft.add(prepared.uri)) haptics.select();
    } catch {
      setNote("Couldn't add that photo. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (openedInitialCamera.current || full) return;
    openedInitialCamera.current = true;
    void capture(true);
  }, [capture, full]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.header}>
        <View>
          <Text variant="title2">Photos</Text>
          <Text variant="footnote" color="textSecondary" accessibilityLiveRegion="polite">{photoCount(photos.length)}</Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Done" style={styles.done}>
          <Text variant="callout" weight="semibold">Done</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumb}>
                <Image source={{ uri }} style={styles.fill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
                <Pressable onPress={() => photoDraft.remove(i)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={space.xs} style={styles.remove}>
                  <Icon name="xmark" color="onAccent" size={size.iconTiny} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Icon name="camera.fill" color="textSecondary" size={size.iconLarge} />
            <Text variant="callout" color="textSecondary" align="center">{busy ? "Opening camera…" : "No photos yet."}</Text>
          </View>
        )}

        {note ? <Text variant="footnote" color="danger" align="center" accessibilityLiveRegion="polite">{note}</Text> : null}
      </View>

      <View style={styles.actions}>
        {!full ? <Button title={photos.length > 0 ? "Take another photo" : "Take a photo"} onPress={() => void capture(false)} loading={busy} /> : null}
        <Button title="Done" variant="plain" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const THUMB = 148;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  done: { minWidth: 64, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", gap: space.md },
  strip: { gap: space.sm, alignItems: "center", paddingVertical: space.lg },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.elevated },
  fill: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: space.xs, right: space.xs, width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: space.sm },
  actions: { gap: space.xs },
});
