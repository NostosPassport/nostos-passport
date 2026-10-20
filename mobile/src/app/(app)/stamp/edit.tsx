import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { api, errorText, mediaUrl } from "@/api";
import { StampResponse, type Song, type StampView } from "@/api/contracts";
import { useStamp } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { CAMERA_NOTE, pickManyFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { saveAcceptedCameraPhoto } from "@/features/photos/save-camera-photo";
import { CAPTION_MAX, stampChanges } from "@/features/stamps/composer";
import { patchStamp } from "@/features/stamps/cache";
import { songDraft } from "@/features/stamps/song-draft";
import { SongRow } from "@/features/stamps/song-row";
import { formatBirthdateInput } from "@/lib/age";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, radius, size, space } from "@/theme";

const YEAR_MS = 366 * 24 * 60 * 60 * 1000;
function displayDate(d: Date) { return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; }
function parseDate(value: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[1]), day = Number(m[2]), year = Number(m[3]);
  const d = new Date(year, month - 1, day, 12);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

export default function EditStamp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stamp = useStamp(id);
  if (!stamp.data) return <FormScreen>{stamp.isError ? <InlineError message={errorText(stamp.error, "Couldn't load this stamp.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} /> : <SkeletonRows count={3} />}</FormScreen>;
  return <EditForm stamp={stamp.data.stamp} />;
}

function EditForm({ stamp }: { stamp: StampView }) {
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState(stamp.caption);
  const [song, setSong] = useState<Song | null>(stamp.song);
  const initialDateText = displayDate(new Date(stamp.visitedAt));
  const [dateValue, setDateValue] = useState(initialDateText);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [now] = useState(Date.now);
  const busyRef = useRef(false);
  const parsed = parseDate(dateValue);
  const invalidDate = !parsed || parsed.getTime() > now || parsed.getTime() < now - YEAR_MS;
  const visitDate = dateValue === initialDateText ? new Date(stamp.visitedAt) : (parsed ?? new Date(stamp.visitedAt));
  const change = stampChanges(stamp, caption, song, visitDate);
  const dirty = Object.keys(change).length > 0;
  const empty = stamp.photos.length === 0 && caption.trim() === "" && song === null;
  useConfirmDiscard(dirty && !saved);

  useFocusEffect(useCallback(() => { const picked = songDraft.take(); if (picked) setSong(picked.song); }, []));

  const save = useMutation({
    mutationFn: () => api.stamps.edit(stamp.id, change),
    onSuccess: (res) => { haptics.success(); setSaved(true); patchStamp(queryClient, stamp.id, () => res.stamp); requestAnimationFrame(() => router.back()); },
    onError: () => haptics.warning(),
  });
  const removePhoto = useMutation({
    mutationFn: (photoId: string) => api.stamps.removePhoto(stamp.id, photoId),
    onSuccess: (res) => { haptics.success(); patchStamp(queryClient, stamp.id, () => res.stamp); },
    onError: (e) => { haptics.warning(); toast.show(errorText(e, "Couldn't remove that photo."), "neutral"); },
  });
  const reorderPhotos = useMutation({
    mutationFn: (ids: string[]) => api.stamps.layout(stamp.id, { photos: ids.map((id, position) => ({ id, position })) }),
    onSuccess: (res) => { haptics.select(); patchStamp(queryClient, stamp.id, () => res.stamp); },
    onError: (e) => { haptics.warning(); toast.show(errorText(e, "Couldn't reorder those photos."), "neutral"); },
  });

  const appendUris = async (items: { uri: string; watermark: boolean }[]) => {
    const prepared = [];
    for (const item of items) prepared.push(await prepareImage(item.uri, { watermark: item.watermark }));
    const form = new FormData();
    for (const [index, photo] of prepared.entries()) form.append("photos", { uri: photo.uri, name: `photo-${index + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
    const res = await api.upload(`/api/stamps/${encodeURIComponent(stamp.id)}/photos`, StampResponse, form);
    patchStamp(queryClient, stamp.id, () => res.stamp);
    return prepared.map((photo) => photo.uri);
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stamp.photos.length || reorderPhotos.isPending) return;
    const photos = [...stamp.photos];
    [photos[index], photos[target]] = [photos[target]!, photos[index]!];
    reorderPhotos.mutate(photos.map((photo) => photo.id));
  };

  const addPhoto = () => {
    if (busyRef.current || stamp.photos.length >= 6) return;
    ActionSheetIOS.showActionSheetWithOptions({ title: "Add photo", options: ["Take Photo", "Choose from Photo Library", "Cancel"], cancelButtonIndex: 2 }, (index) => {
      if (index === 2) return;
      void (async () => {
        busyRef.current = true; setPhotoBusy(true);
        try {
          if (index === 0) {
            const result = await takePhoto();
            if (result === "cancelled") return;
            if (typeof result === "string") { toast.show(CAMERA_NOTE[result], "neutral"); return; }
            const [uri] = await appendUris([{ uri: result.uri, watermark: true }]);
            if (uri) await saveAcceptedCameraPhoto(uri);
          } else {
            const remaining = 6 - stamp.photos.length;
            const picked = await pickManyFromLibrary(remaining);
            if (!picked.length) return;
            await appendUris(picked.slice(0, remaining).map((photo) => ({ uri: photo.uri, watermark: false })));
          }
          haptics.success();
        } catch (e) { haptics.warning(); toast.show(errorText(e, "Couldn't add those photos."), "neutral"); }
        finally { busyRef.current = false; setPhotoBusy(false); }
      })();
    });
  };

  const doSave = () => {
    if (!dirty || invalidDate || empty || save.isPending) return;
    const dateChanged = dateValue !== initialDateText;
    if (stamp.verified && dateChanged) {
      Alert.alert("Change visit date?", "This visit was verified for its original date. Changing the date will remove verification.", [
        { text: "Cancel", style: "cancel" },
        { text: "Change date", style: "destructive", onPress: () => save.mutate() },
      ]);
    } else save.mutate();
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: "Edit memory", headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />, headerRight: () => <HeaderButton label="Save" bold onPress={doSave} disabled={!dirty || invalidDate || empty || save.isPending} /> }} />

      <FieldGroup footer="Visit date, up to one year ago" errors={[invalidDate ? "Use MM/DD/YYYY, within the last year and not in the future." : null]}>
        <TextInput value={dateValue} onChangeText={(value) => setDateValue(formatBirthdateInput(value))} keyboardType="number-pad" maxLength={10} placeholder="MM/DD/YYYY" placeholderTextColor={colors.textTertiary} style={styles.dateInput} accessibilityLabel="Visit date" />
        {stamp.verified ? <Text variant="footnote" color="accent">Nostos verified this visit. Changing the day removes verification.</Text> : <Text variant="footnote" color="textTertiary">Visit not location verified.</Text>}
      </FieldGroup>

      <View style={styles.photoBlock}>
        <View style={styles.photoHeader}><Text variant="headline">Photos</Text><Text variant="footnote" color="textSecondary">{stamp.photos.length} / 6</Text></View>
        {stamp.photos.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {stamp.photos.map((photo, index) => (
                <View key={photo.id} style={styles.thumb}>
                  <Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text variant="caption2" color="onAccent" weight="semibold">COVER</Text></View> : null}
                  <Pressable onPress={() => Alert.alert("Remove photo?", "This removes it from the stamp.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removePhoto.mutate(photo.id) }])} accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.removePhoto}><Icon name="xmark" color="onAccent" size={16} /></Pressable>
                  <View style={styles.orderControls}>
                    <Pressable disabled={index === 0 || reorderPhotos.isPending} onPress={() => movePhoto(index, -1)} accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} earlier`} style={[styles.orderButton, index === 0 && styles.orderDisabled]}><Icon name="chevron.left" color="onAccent" size={15} /></Pressable>
                    <Pressable disabled={index === stamp.photos.length - 1 || reorderPhotos.isPending} onPress={() => movePhoto(index, 1)} accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} later`} style={[styles.orderButton, index === stamp.photos.length - 1 && styles.orderDisabled]}><Icon name="chevron.right" color="onAccent" size={15} /></Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text variant="footnote" color="textSecondary">The first photo is the stamp cover. Use the arrows to reorder photos.</Text>
          </>
        ) : <Text variant="callout" color="textSecondary">No photos on this stamp.</Text>}
        {stamp.photos.length < 6 ? <Button title="Add photos" icon="plus" variant="secondary" onPress={addPhoto} loading={photoBusy} /> : null}
      </View>

      <FieldGroup footer={`${caption.length}/${CAPTION_MAX}`} errors={[empty ? "Add a photo, caption or song." : null]}>
        <Field label="Caption" value={caption} onChangeText={setCaption} maxLength={CAPTION_MAX} placeholder="What's it like?" multiline inputAccessoryViewButtonLabel="Done" returnKeyType="done" submitBehavior="blurAndSubmit" />
      </FieldGroup>
      {song ? <SongRow song={song} trailing={<Pressable onPress={() => setSong(null)} accessibilityRole="button" accessibilityLabel="Remove song" hitSlop={space.xs} style={styles.remove}><Icon name="xmark.circle.fill" color="textTertiary" size={size.icon} /></Pressable>} /> : <Button title="Add a song" icon="music.note" variant="secondary" onPress={() => router.push("/stamp/song")} />}
      {save.error && <InlineError message={errorText(save.error, "Couldn't save. Try again.")} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  remove: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  dateInput: { minHeight: 48, color: colors.textPrimary, fontSize: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.textTertiary },
  photoBlock: { gap: space.sm },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoStrip: { gap: space.sm },
  thumb: { width: 112, height: 112, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.elevated },
  coverBadge: { position: "absolute", left: 6, top: 6, minHeight: 24, paddingHorizontal: 7, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  removePhoto: { position: "absolute", right: 6, top: 6, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  orderControls: { position: "absolute", left: 6, right: 6, bottom: 6, flexDirection: "row", justifyContent: "space-between" },
  orderButton: { width: 32, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  orderDisabled: { opacity: 0.3 },
});