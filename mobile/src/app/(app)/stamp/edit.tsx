import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";

import { api, errorText, mediaUrl } from "@/api";
import { StampResponse, type Song, type StampView } from "@/api/contracts";
import { useStamp } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { HeaderButton, headerTextButtons } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ScreenState } from "@/components/ui/screen-state";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { CAMERA_NOTE, pickManyFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { saveAcceptedCameraPhoto } from "@/features/photos/save-camera-photo";
import { CAPTION_MAX, stampChanges } from "@/features/stamps/composer";
import { patchStamp } from "@/features/stamps/cache";
import { useRevealAboveKeyboard } from "@/features/stamps/reveal-above-keyboard";
import { songDraft } from "@/features/stamps/song-draft";
import { AddSongRow } from "@/features/stamps/add-song-row";
import { RemoveSongButton, SongRow } from "@/features/stamps/song-row";
import { MAX_STAMP_PHOTOS } from "@/features/stamps/stamp-flow";
import { useVisitDateField, visitDateText } from "@/features/stamps/visit-date";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, dimmedOpacity, fonts, radius, screenPadding, size, space, type as typeScale } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

const TITLE = "Edit memory";
const THUMB = 112;

export default function EditStamp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stamp = useStamp(id);
  if (!stamp.data) {
    // Loading and error keep a way out: the header Cancel is there in every state.
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: TITLE, ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} /> }) }} />
        {stamp.isError
          ? <ScreenState kind="error" message={errorText(stamp.error, "Couldn't load this stamp.")} onRetry={() => void stamp.refetch()} retrying={stamp.isFetching} />
          : <ScreenState kind="loading" />}
      </View>
    );
  }
  return <EditForm stamp={stamp.data.stamp} />;
}

function EditForm({ stamp }: { stamp: StampView }) {
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState(stamp.caption);
  const [song, setSong] = useState<Song | null>(stamp.song);
  const [now] = useState(Date.now);
  const initialDateText = visitDateText(new Date(stamp.visitedAt));
  const visitDate = useVisitDateField(initialDateText, now);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photosChanged, setPhotosChanged] = useState(false);
  const busyRef = useRef(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const reveal = useRevealAboveKeyboard(scroller);
  const captionY = useRef(0);
  const dateChanged = visitDate.text !== initialDateText;
  // An unchanged date is always fine, even for a stamp now more than a year old.
  const invalidDate = dateChanged && !visitDate.check.ok;
  const visitDateValue = dateChanged && visitDate.check.ok ? visitDate.check.date : new Date(stamp.visitedAt);
  const change = stampChanges(stamp, caption, song, visitDateValue);
  const dirty = Object.keys(change).length > 0;
  const empty = stamp.photos.length === 0 && caption.trim() === "" && song === null;
  // Photos save as soon as they change; the discard prompt says so instead of implying they will be undone (P-115).
  const { allowLeave } = useConfirmDiscard(dirty && !saved, {
    message: photosChanged ? "Your caption, date and song changes haven't been saved. Photo changes were saved when you made them." : undefined,
  });

  useFocusEffect(useCallback(() => { const picked = songDraft.take(); if (picked) setSong(picked.song); }, []));
  // Leave only after `saved` (and the dropped discard block) has committed, so the alert can't flash (P-087).
  useEffect(() => { if (saved) nav.back(); }, [saved]);

  const save = useMutation({
    mutationFn: () => api.stamps.edit(stamp.id, change),
    onSuccess: (res) => { haptics.success(); patchStamp(queryClient, stamp.id, () => res.stamp); allowLeave(); setSaved(true); },
    // The error shows at the top of the form, where Save is, not below the fold (P-117).
    onError: () => { haptics.warning(); scroller.current?.scrollTo({ y: 0, animated: true }); },
  });
  const removePhoto = useMutation({
    mutationFn: (photoId: string) => api.stamps.removePhoto(stamp.id, photoId),
    onSuccess: (res) => { haptics.success(); setPhotosChanged(true); patchStamp(queryClient, stamp.id, () => res.stamp); },
    onError: (e) => { haptics.warning(); toast.show(errorText(e, "Couldn't remove that photo."), "neutral"); },
  });
  const reorderPhotos = useMutation({
    mutationFn: (ids: string[]) => api.stamps.layout(stamp.id, { photos: ids.map((id, position) => ({ id, position })) }),
    // Move the thumbnails at once and put them back if the server says no (P-116).
    onMutate: (ids: string[]): StampView["photos"] => {
      const previous = stamp.photos;
      const byId = new Map(previous.map((photo) => [photo.id, photo]));
      const next = ids.flatMap((id) => { const photo = byId.get(id); return photo ? [photo] : []; });
      patchStamp(queryClient, stamp.id, (s) => ({ ...s, photos: next }));
      return previous;
    },
    onSuccess: (res) => { haptics.select(); setPhotosChanged(true); patchStamp(queryClient, stamp.id, () => res.stamp); },
    onError: (e, _ids, previous) => {
      haptics.warning();
      if (previous) patchStamp(queryClient, stamp.id, (s) => ({ ...s, photos: previous }));
      toast.show(errorText(e, "Couldn't reorder those photos."), "neutral");
    },
  });

  const appendUris = async (items: { uri: string; watermark: boolean }[]) => {
    const prepared = [];
    for (const item of items) prepared.push(await prepareImage(item.uri, { watermark: item.watermark }));
    const form = new FormData();
    for (const [index, photo] of prepared.entries()) form.append("photos", { uri: photo.uri, name: `photo-${index + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
    const res = await api.upload(`/api/stamps/${encodeURIComponent(stamp.id)}/photos`, StampResponse, form);
    patchStamp(queryClient, stamp.id, () => res.stamp);
    setPhotosChanged(true);
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
    if (busyRef.current || stamp.photos.length >= MAX_STAMP_PHOTOS) return;
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
            // Same notes as the composer's Photos screen when the copy to Photos doesn't work (P-103).
            const copy = uri ? await saveAcceptedCameraPhoto(uri) : "saved";
            if (copy === "permission-denied") toast.show("Photo added. Allow Nostos to add photos in Settings to save a copy to Photos.", "neutral");
            else if (copy === "failed") toast.show("Photo added, but Nostos couldn't save a copy to Photos.", "neutral");
          } else {
            const remaining = MAX_STAMP_PHOTOS - stamp.photos.length;
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
    if (stamp.verified && dateChanged) {
      Alert.alert("Change visit date?", "This visit was verified for its original date. Changing the date will remove verification.", [
        { text: "Cancel", style: "cancel" },
        { text: "Change date", style: "destructive", onPress: () => save.mutate() },
      ]);
    } else save.mutate();
  };

  const reordering = reorderPhotos.isPending;
  return (
    <ScrollView
      ref={scroller}
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: TITLE, ...headerTextButtons({ left: <HeaderButton label="Cancel" onPress={() => nav.back()} />, right: <HeaderButton label="Save" bold onPress={doSave} disabled={!dirty || invalidDate || empty} loading={save.isPending} /> }) }} />

      {save.error ? <InlineError message={errorText(save.error, "Couldn't save. Try again.")} onRetry={doSave} retrying={save.isPending} /> : null}

      <FieldGroup footer="Up to one year ago, not in the future.">
        <Field label="Visit date" value={visitDate.text} onChangeText={visitDate.setText} onBlur={visitDate.onBlur} {...visitDate.inputProps} error={dateChanged ? visitDate.error : null} style={styles.dateInput} />
        {stamp.verified ? <Text variant="footnote" color="accent">Nostos verified this visit. Changing the day removes verification.</Text> : <Text variant="footnote" color="textTertiary">Visit not location verified.</Text>}
      </FieldGroup>

      <View style={styles.photoBlock}>
        <View style={styles.photoHeader}><Text variant="headline">Photos</Text><Text variant="footnote" color="textSecondary">{stamp.photos.length} of {MAX_STAMP_PHOTOS}</Text></View>
        {stamp.photos.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {stamp.photos.map((photo, index) => (
                <View key={photo.id} style={styles.thumb}>
                  <Image source={{ uri: mediaUrl(photo.url), cacheKey: photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text variant="caption" color="onAccent" weight="semibold">COVER</Text></View> : null}
                  <Tappable onPress={() => Alert.alert("Remove photo?", "This removes it from the stamp right away.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removePhoto.mutate(photo.id) }])} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} hitSlop={space.xs} style={styles.removePhoto}><Icon name="xmark" color="onAccent" size={size.iconTiny} /></Tappable>
                  <View style={[styles.orderControls, reordering && styles.dimmed]}>
                    <Tappable disabled={index === 0 || reordering} onPress={() => movePhoto(index, -1)} accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} earlier`} accessibilityState={{ disabled: index === 0 || reordering }} hitSlop={space.xs} style={[styles.orderButton, index === 0 && styles.orderDisabled]}><Icon name="chevron.left" color="onAccent" size={size.iconTiny} /></Tappable>
                    <Tappable disabled={index === stamp.photos.length - 1 || reordering} onPress={() => movePhoto(index, 1)} accessibilityRole="button" accessibilityLabel={`Move photo ${index + 1} later`} accessibilityState={{ disabled: index === stamp.photos.length - 1 || reordering }} hitSlop={space.xs} style={[styles.orderButton, index === stamp.photos.length - 1 && styles.orderDisabled]}><Icon name="chevron.right" color="onAccent" size={size.iconTiny} /></Tappable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text variant="footnote" color="textSecondary">The first photo is the stamp cover. Use the arrows to reorder.</Text>
          </>
        ) : <Text variant="callout" color="textSecondary">No photos on this stamp.</Text>}
        {stamp.photos.length < MAX_STAMP_PHOTOS ? <Button title="Add photos" icon="plus" variant="secondary" onPress={addPhoto} loading={photoBusy} /> : <Text variant="footnote" color="textSecondary">{MAX_STAMP_PHOTOS} of {MAX_STAMP_PHOTOS}. Remove one to add another.</Text>}
        <Text variant="footnote" color="textTertiary">Photo changes save right away. Save applies the date, words and song.</Text>
      </View>

      <View onLayout={(event) => { captionY.current = event.nativeEvent.layout.y; }}>
        <FieldGroup footer={`${caption.length} / ${CAPTION_MAX}`}>
          <Field label="A few words" value={caption} onChangeText={setCaption} onFocus={() => reveal(captionY.current)} error={empty ? "Add a photo, caption or song." : null} maxLength={CAPTION_MAX} placeholder="An afternoon worth keeping." multiline inputAccessoryViewButtonLabel="Done" returnKeyType="done" submitBehavior="blurAndSubmit" style={styles.captionInput} />
        </FieldGroup>
      </View>
      {song ? <SongRow song={song} trailing={<RemoveSongButton onPress={() => setSong(null)} />} /> : <AddSongRow onPress={() => nav.push("/stamp/song")} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Matches FormScreen, with a ref so the form can scroll a field or an error into view.
  root: { flex: 1, backgroundColor: colors.transparent },
  content: { paddingHorizontal: screenPadding, paddingTop: space.xs, gap: space.xl, paddingBottom: space.xxxl },
  // The date reads like the composer's: typewriter digits. The caption is set in the serif like the composer (P-118).
  dateInput: { fontFamily: fonts.mono, fontSize: typeScale.title2.fontSize },
  captionInput: { fontFamily: typeScale.title.fontFamily, fontSize: typeScale.title.fontSize, lineHeight: typeScale.title.lineHeight },
  photoBlock: { gap: space.sm },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoStrip: { gap: space.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.elevated },
  coverBadge: { position: "absolute", left: space.xs, top: space.xs, minHeight: size.avatarSmall, paddingHorizontal: space.xs, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  // 32pt discs plus an 8pt hit slop: 48pt targets that don't overlap inside the 112pt thumbnail (P-116).
  removePhoto: { position: "absolute", right: space.xxs, top: space.xxs, width: space.xxl, height: space.xxl, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  orderControls: { position: "absolute", left: space.xxs, right: space.xxs, bottom: space.xxs, flexDirection: "row", justifyContent: "space-between" },
  orderButton: { width: space.xxl, height: space.xxl, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim },
  orderDisabled: { opacity: 0.3 },
  dimmed: { opacity: dimmedOpacity },
});
