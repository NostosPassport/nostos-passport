import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { CAMERA_NOTE, pickFromLibrary, pickManyFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { saveAcceptedCameraPhoto } from "@/features/photos/save-camera-photo";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { MAX_STAMP_PHOTOS, photoCount } from "@/features/stamps/stamp-flow";
import { haptics } from "@/lib/haptics";
import { colors, radius, screenPadding, size, space } from "@/theme";

export default function StampCamera() {
  const insets = useSafeAreaInsets();
  const photos = usePhotoDraft();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const full = photos.length >= MAX_STAMP_PHOTOS;

  const startWork = useCallback(() => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return false;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    return true;
  }, []);
  const finishWork = useCallback(() => { busyRef.current = false; setBusy(false); }, []);

  const capture = useCallback(async () => {
    if (!startWork()) return;
    try {
      const outcome = await takePhoto();
      if (outcome === "cancelled") return;
      if (typeof outcome === "string") { setNote(CAMERA_NOTE[outcome]); return; }
      const prepared = await prepareImage(outcome.uri, { watermark: true });
      if (photoDraft.add(prepared.uri)) {
        haptics.select();
        const saved = await saveAcceptedCameraPhoto(prepared.uri);
        if (saved === "permission-denied") setNote("Photo added. Allow Nostos to add photos in Settings to save a copy to Photos.");
        else if (saved === "failed") setNote("Photo added, but Nostos couldn't save a copy to Photos.");
      }
    } catch { setNote("Couldn't add that photo. Try again."); } finally { finishWork(); }
  }, [finishWork, startWork]);

  const chooseLibraryPhotos = useCallback(async () => {
    if (!startWork()) return;
    try {
      const remaining = MAX_STAMP_PHOTOS - photoDraft.get().length;
      let picked = typeof pickManyFromLibrary === "function" ? await pickManyFromLibrary(remaining) : [];
      if (!picked.length && typeof pickManyFromLibrary !== "function") {
        const single = await pickFromLibrary();
        picked = single ? [single] : [];
      }
      if (!picked.length) return;
      let added = 0;
      for (const item of picked.slice(0, remaining)) {
        const prepared = await prepareImage(item.uri);
        if (photoDraft.add(prepared.uri)) added += 1;
      }
      if (added > 0) haptics.select();
    } catch { setNote("Couldn't add those photos. Try again."); } finally { finishWork(); }
  }, [finishWork, startWork]);

  const chooseSource = useCallback(() => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return;
    ActionSheetIOS.showActionSheetWithOptions({ title: "Add photo", options: ["Take Photo", "Choose from Photo Library", "Cancel"], cancelButtonIndex: 2 }, (index) => {
      if (index === 0) void capture();
      else if (index === 1) void chooseLibraryPhotos();
    });
  }, [capture, chooseLibraryPhotos]);

  const viewerPhotos = photos.map((uri, index) => ({ id: `${uri}-${index}`, uri }));
  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.header}>
        <View><Text variant="title2">Photos</Text><Text variant="footnote" color="textSecondary">{photoCount(photos.length)}</Text></View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Done" style={styles.done}><Text variant="callout" weight="semibold">Done</Text></Pressable>
      </View>
      <View style={styles.body}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumb}>
                <Pressable onPress={() => setViewingPhoto(i)} accessibilityRole="button" accessibilityLabel={`Open photo ${i + 1}`} style={styles.fill}>
                  <Image source={{ uri }} style={styles.fill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
                </Pressable>
                <Pressable onPress={() => photoDraft.remove(i)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={space.xs} style={styles.remove}><Icon name="xmark" color="onAccent" size={size.iconTiny} /></Pressable>
              </View>
            ))}
          </ScrollView>
        ) : <View style={styles.empty}><Icon name="photo.on.rectangle" color="textSecondary" size={size.iconLarge} /><Text variant="callout" color="textSecondary" align="center">{busy ? "Adding photo…" : "No photos yet."}</Text></View>}
        {note ? <Text variant="footnote" color="danger" align="center">{note}</Text> : null}
      </View>
      <View style={styles.actions}>
        {!full ? <Button title={photos.length > 0 ? "Add another photo" : "Add a photo"} onPress={chooseSource} loading={busy} /> : null}
        <Button title="Done" variant="plain" onPress={() => router.back()} />
      </View>
      <PhotoViewer photos={viewerPhotos} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
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
