import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { MAX_STAMP_PHOTOS, photoCount } from "@/features/stamps/stamp-flow";
import { prepareImage } from "@/features/photos/prepare";
import { haptics } from "@/lib/haptics";
import { colors, radius, screenPadding, size, space } from "@/theme";

/**
 * The in-app camera for a stamp's photos, up to six. Photos are taken here and nowhere else: they are proof you were at the place.
 * Each shot goes straight into the stamp being made; Done goes back to it.
 */
export default function StampCamera() {
  const [permission, request] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const photos = usePhotoDraft();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const full = photos.length >= MAX_STAMP_PHOTOS;

  const shoot = async () => {
    if (!ref.current || busy || full) return;
    setBusy(true);
    setNote(null);
    try {
      const shot = await ref.current.takePictureAsync({ quality: 1, exif: false, skipProcessing: false });
      const prepared = await prepareImage(shot.uri);
      if (photoDraft.add(prepared.uri)) haptics.select();
    } catch {
      setNote("Couldn't take that photo. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Opening the camera">
        <Text variant="callout" color="textSecondary">
          Opening the camera…
        </Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Icon name="camera.fill" color="dimBrass" size={size.iconLarge} />
        <Text variant="title2" align="center">
          Camera access
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          Nostos takes your stamp photos here, inside the app, so they show where you really are.
        </Text>
        <Button
          title={permission.canAskAgain ? "Allow the camera" : "Open Settings"}
          block={false}
          onPress={() => (permission.canAskAgain ? void request() : void Linking.openSettings())}
        />
        <Button title="Not now" variant="plain" block={false} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={ref} style={styles.preview} facing="back" onCameraReady={() => setReady(true)} accessibilityLabel="Camera" />
      <View style={styles.top}>
        <Text variant="typewriterSmall" color="brass" accessibilityLiveRegion="polite">
          {photoCount(photos.length)}
        </Text>
      </View>
      <View style={styles.bottom}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumb}>
                <Image source={{ uri }} style={styles.fill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
                <Pressable onPress={() => photoDraft.remove(i)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={space.xs} style={styles.remove}>
                  <Icon name="xmark" color="textPrimary" size={size.iconTiny} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {note ? (
          <Text variant="footnote" color="textSecondary" align="center" accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
        <View style={styles.controls}>
          <View style={styles.side} />
          <Pressable
            onPress={() => void shoot()}
            disabled={!ready || busy || full}
            accessibilityRole="button"
            accessibilityLabel={full ? "Six photos taken" : "Take photo"}
            accessibilityState={{ disabled: !ready || busy || full }}
            style={[styles.shutter, (!ready || busy || full) && styles.shutterOff]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.side}>
            <Button title="Done" variant="plain" block={false} onPress={() => router.back()} />
          </View>
        </View>
      </View>
    </View>
  );
}

const THUMB = size.listRow;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: screenPadding, backgroundColor: colors.background },
  preview: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  top: { position: "absolute", top: space.xxxl + space.md, alignSelf: "center", paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, backgroundColor: colors.scrim },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: space.xxxl, gap: space.sm, backgroundColor: colors.scrim },
  strip: { gap: space.xs, paddingHorizontal: screenPadding, paddingTop: space.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.chip, overflow: "hidden", backgroundColor: colors.elevated },
  remove: { position: "absolute", top: space.xxs, right: space.xxs, width: size.iconSmall + space.xs, height: size.iconSmall + space.xs, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: screenPadding },
  side: { width: size.avatarLarge, alignItems: "flex-end" },
  shutter: { width: size.avatarLarge + space.xs, height: size.avatarLarge + space.xs, borderRadius: radius.pill, borderWidth: size.focusRingWidth, borderColor: colors.brass, alignItems: "center", justifyContent: "center" },
  shutterOff: { opacity: 0.45 },
  shutterInner: { width: size.avatarLarge - space.md, height: size.avatarLarge - space.md, borderRadius: radius.pill, backgroundColor: colors.brass },
});
