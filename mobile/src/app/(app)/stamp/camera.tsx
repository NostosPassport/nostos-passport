import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CAMERA_NOTE, pickFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { validateLibraryPhoto, type LibraryPhotoValidationContext } from "@/features/photos/validate-library";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { MAX_STAMP_PHOTOS, photoCount } from "@/features/stamps/stamp-flow";
import { haptics } from "@/lib/haptics";
import { colors, radius, screenPadding, size, space } from "@/theme";

const param = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default function StampCamera() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const photos = usePhotoDraft();
  const initialPhotoCount = useRef(photoDraft.get().length);
  const openedInitialChooser = useRef(false);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const full = photos.length >= MAX_STAMP_PHOTOS;

  const validationContext = useMemo<LibraryPhotoValidationContext | null>(() => {
    const placeName = param(params.placeName);
    const placeLat = Number(param(params.placeLat));
    const placeLng = Number(param(params.placeLng));
    const placeRadius = Number(param(params.placeRadius));
    const stampAt = Number(param(params.stampAt));
    if (!placeName || !Number.isFinite(placeLat) || !Number.isFinite(placeLng) || !Number.isFinite(placeRadius) || !Number.isFinite(stampAt)) return null;
    return { place: { name: placeName, lat: placeLat, lng: placeLng, geofenceMeters: placeRadius }, stampAt };
  }, [params.placeLat, params.placeLng, params.placeName, params.placeRadius, params.stampAt]);

  const startWork = useCallback(() => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return false;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    return true;
  }, []);

  const finishWork = useCallback(() => {
    busyRef.current = false;
    setBusy(false);
  }, []);

  const capture = useCallback(async (initial = false) => {
    if (!startWork()) return;
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
      finishWork();
    }
  }, [finishWork, startWork]);

  const chooseLibraryPhoto = useCallback(async (initial = false) => {
    if (!startWork()) return;
    try {
      const picked = await pickFromLibrary();
      if (!picked) {
        if (initial && initialPhotoCount.current === 0) router.back();
        return;
      }
      if (!validationContext) {
        Alert.alert("This photo can't be added", "Nostos couldn't validate this photo for the current stamp.");
        return;
      }

      const validation = validateLibraryPhoto(picked, validationContext);
      if (!validation.viable) {
        haptics.warning();
        Alert.alert("This photo can't be added", validation.reason ?? "We couldn't verify that this photo belongs with this stamp.");
        return;
      }

      const prepared = await prepareImage(picked.uri);
      if (photoDraft.add(prepared.uri)) haptics.select();
    } catch {
      setNote("Couldn't add that photo. Try again.");
    } finally {
      finishWork();
    }
  }, [finishWork, startWork, validationContext]);

  const chooseSource = useCallback((initial = false) => {
    if (busyRef.current || photoDraft.get().length >= MAX_STAMP_PHOTOS) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Add photo",
        options: ["Take Photo", "Choose from Photo Library", "Cancel"],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) void capture(initial);
        else if (index === 1) void chooseLibraryPhoto(initial);
        else if (initial && initialPhotoCount.current === 0) router.back();
      },
    );
  }, [capture, chooseLibraryPhoto]);

  useEffect(() => {
    if (openedInitialChooser.current || full) return;
    openedInitialChooser.current = true;
    requestAnimationFrame(() => chooseSource(true));
  }, [chooseSource, full]);

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
            <Icon name="photo.on.rectangle" color="textSecondary" size={size.iconLarge} />
            <Text variant="callout" color="textSecondary" align="center">{busy ? "Adding photo…" : "No photos yet."}</Text>
          </View>
        )}

        {note ? <Text variant="footnote" color="danger" align="center" accessibilityLiveRegion="polite">{note}</Text> : null}
      </View>

      <View style={styles.actions}>
        {!full ? <Button title={photos.length > 0 ? "Add another photo" : "Add a photo"} onPress={() => chooseSource(false)} loading={busy} /> : null}
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
