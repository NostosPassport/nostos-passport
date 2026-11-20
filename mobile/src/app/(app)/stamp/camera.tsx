import { Image } from "expo-image";
import { useCallback, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, ScrollView, StyleSheet, Text as NativeText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisplayTitle, EditorialButton, Kicker } from "@/components/editorial/editorial";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { CAMERA_NOTE, pickFromLibrary, pickManyFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { saveAcceptedCameraPhoto } from "@/features/photos/save-camera-photo";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { MAX_STAMP_PHOTOS, photoCount } from "@/features/stamps/stamp-flow";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, screenPadding, shadows, size, space, type } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

export default function StampCamera() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photos = usePhotoDraft();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  // "info" notes (the photo was added, only the Photos copy failed) are not errors and must not read red (P-102).
  const [note, setNote] = useState<{ text: string; tone: "info" | "error" } | null>(null);
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
      if (typeof outcome === "string") { setNote({ text: CAMERA_NOTE[outcome], tone: outcome === "failed" ? "error" : "info" }); return; }
      const prepared = await prepareImage(outcome.uri, { watermark: true });
      if (photoDraft.add(prepared.uri)) {
        haptics.select();
        const saved = await saveAcceptedCameraPhoto(prepared.uri);
        if (saved === "permission-denied") setNote({ text: "Photo added. Allow Nostos to add photos in Settings to save a copy to Photos.", tone: "info" });
        else if (saved === "failed") setNote({ text: "Photo added, but Nostos couldn't save a copy to Photos.", tone: "info" });
      }
    } catch { setNote({ text: "Couldn't add that photo. Try again.", tone: "error" }); } finally { finishWork(); }
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
    } catch { setNote({ text: "Couldn't add those photos. Try again.", tone: "error" }); } finally { finishWork(); }
  }, [finishWork, startWork]);

  const chooseSource = useCallback(() => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return;
    ActionSheetIOS.showActionSheetWithOptions({ title: "Add photo", options: ["Take Photo", "Choose from Photo Library", "Cancel"], cancelButtonIndex: 2 }, (index) => {
      if (index === 0) void capture();
      else if (index === 1) void chooseLibraryPhotos();
    });
  }, [capture, chooseLibraryPhotos]);

  const viewerPhotos = photos.map((uri, index) => ({ id: `${uri}-${index}`, uri }));
  // Six slots in a 3 x 2 grid anchored under the header: filled slots show the photo, open slots invite the next
  // one. The first photo is the stamp cover. No lone thumbnail floating in empty space.
  const slot = Math.floor((width - screenPadding * 2 - space.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const slots = Array.from({ length: MAX_STAMP_PHOTOS }, (_, i) => photos[i] ?? null);
  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.header}>
        <View style={styles.heading}><Kicker>STAMP PHOTOS</Kicker><DisplayTitle size={DISPLAY_SIZE}>Photos</DisplayTitle><Text variant="footnote" color="textSecondary">{photoCount(photos.length)}</Text><Text variant="footnote" color="textTertiary">The first photo is the stamp cover.</Text></View>
        {/* The one Done. It waits while photos are still being prepared, so the composer never opens without them (P-100, P-101). */}
        <HeaderButton label="Done" bold onPress={() => nav.back()} loading={busy} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {slots.map((uri, i) =>
            uri ? (
              <View key={`${uri}-${i}`} style={[styles.slot, styles.filled, { width: slot, height: slot }]}>
                <Tappable onPress={() => setViewingPhoto(i)} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${photos.length}${i === 0 ? ", cover" : ""}`} accessibilityHint="Opens the photo full screen" style={styles.fill}>
                  <Image source={{ uri }} style={styles.fill} contentFit="cover" />
                </Tappable>
                {i === 0 ? <View style={styles.coverTag} pointerEvents="none"><NativeText style={styles.coverText}>COVER</NativeText></View> : null}
                <Tappable onPress={() => photoDraft.remove(i)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={space.xs} style={styles.remove}><Icon name="xmark" color="onAccent" size={size.iconTiny} /></Tappable>
              </View>
            ) : i === photos.length && busy ? (
              <View key={`busy-${i}`} style={[styles.slot, styles.open, { width: slot, height: slot }]} accessible accessibilityRole="progressbar" accessibilityLabel="Adding photo">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : i === photos.length ? (
              <Tappable key={`open-${i}`} onPress={chooseSource} disabled={busy} accessibilityRole="button" accessibilityLabel={i === 0 ? "Add a photo" : "Add another photo"} style={[styles.slot, styles.open, styles.next, { width: slot, height: slot }]}>
                <Icon name="plus" color="accent" size={size.iconSmall} />
              </Tappable>
            ) : (
              // Later open slots only show how many photos fit; the next slot (and the button below) adds one.
              <View key={`open-${i}`} style={[styles.slot, styles.open, { width: slot, height: slot }]} accessible={false} importantForAccessibility="no" />
            ),
          )}
        </View>
        {photos.length === 0 && !busy ? <Text variant="callout" color="textSecondary">Take a photo or pick up to {MAX_STAMP_PHOTOS} from your library.</Text> : null}
        {note ? <Text variant="footnote" color={note.tone === "error" ? "danger" : "textSecondary"} accessibilityLiveRegion="polite">{note.text}</Text> : null}
      </ScrollView>
      <View style={styles.actions}>
        {full ? <Text variant="footnote" color="textSecondary" align="center">{MAX_STAMP_PHOTOS} of {MAX_STAMP_PHOTOS}. Remove one to add another.</Text> : <EditorialButton label={photos.length > 0 ? "+  Add more photos" : "+  Add photos"} outline loading={busy} onPress={chooseSource} />}
      </View>
      <PhotoViewer photos={viewerPhotos} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </View>
  );
}

const GRID_COLUMNS = 3;
const DISPLAY_SIZE = 44;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
  heading: { flex: 1, gap: space.xxs },
  body: { flex: 1, marginTop: space.lg },
  bodyContent: { gap: space.md, paddingBottom: space.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  slot: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  filled: { backgroundColor: colors.paperDeep, borderWidth: space.xxs, borderColor: colors.paperRaised, ...shadows.contact },
  open: { backgroundColor: colors.paperDeep, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderStyle: "dashed" },
  next: { borderColor: colors.accent },
  fill: { width: "100%", height: "100%" },
  coverTag: { position: "absolute", left: space.xxs, bottom: space.xxs, backgroundColor: colors.paperRaised, paddingHorizontal: space.xxs, paddingVertical: 2 },
  coverText: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: type.caption.fontSize - 3, letterSpacing: 1 },
  remove: { position: "absolute", top: space.xxs, right: space.xxs, width: size.iconLarge, height: size.iconLarge, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  actions: { gap: space.xs, paddingTop: space.sm },
});
