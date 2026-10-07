import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, InputAccessoryView, Keyboard, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
import { CreateStampResponse, type NearbyPlacesResponse, type Song } from "@/api/contracts";
import { qk } from "@/api/keys";
import { useNearbyPlaces, usePlaces } from "@/api/queries";
import { EditorialButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { devSimulator } from "@/features/location/dev-simulator";
import { locationStore, usePermissionRefresh, useLocationState, useUserCoords } from "@/features/location/location-store";
import { SimulatedLocationChip } from "@/features/location/sim-chip";
import { autoPlace, CAPTION_MAX, orderPlaces, stampFields, stampProblem } from "@/features/stamps/composer";
import { landingDraft } from "@/features/stamps/landing-draft";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { songDraft } from "@/features/stamps/song-draft";
import { MAX_STAMP_PHOTOS, placeRowText, placeSections, stampReadiness } from "@/features/stamps/stamp-flow";
import { SongRow } from "@/features/stamps/song-row";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, fonts } from "@/theme";

type Nearby = NearbyPlacesResponse["places"][number];
const CAPTION_ACCESSORY_ID = "stamp-caption-accessory";

export default function NewStamp() {
  return <Composer />;
}

function Composer() {
  usePermissionRefresh();
  useEffect(() => () => photoDraft.clear(), []);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { permission } = useLocationState();
  const coords = useUserCoords();
  const nearby = useNearbyPlaces(coords);
  const [stampAt, setStampAt] = useState(() => Date.now());
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [choosingPlace, setChoosingPlace] = useState(false);
  const photoUris = usePhotoDraft();
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const photoWidth = Math.max(1, width - 48);
  const currentPhoto = photoUris.length > 0 ? Math.min(activePhoto, photoUris.length - 1) : 0;

  const draft = { photoUris, caption, song };
  const dirty = !done && (photoUris.length > 0 || caption.trim() !== "" || song !== null);
  useConfirmDiscard(dirty);

  const places = orderPlaces(nearby.data?.places ?? []);
  const selectedPlace = places.find((p) => p.id === chosenId) ?? null;
  const place: Nearby | null = choosingPlace ? null : selectedPlace ?? autoPlace(places);

  const openPhotos = () => {
    if (!place) return;
    Keyboard.dismiss();
    router.push({
      pathname: "/stamp/camera",
      params: {
        placeName: place.name,
        placeLat: String(place.lat),
        placeLng: String(place.lng),
        placeRadius: String(place.geofenceMeters),
        stampAt: String(stampAt),
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      const picked = songDraft.take();
      if (picked) setSong(picked.song);
    }, []),
  );

  const stamp = useMutation({
    mutationFn: async () => {
      if (!place) throw new Error("no place");
      const here = (await locationStore.currentForPosting()) ?? coords;
      if (!here) throw new Error("no location");
      const form = new FormData();
      for (const [i, uri] of photoUris.entries()) form.append("photos", { uri, name: `photo-${i + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
      for (const [k, v] of stampFields(draft, here)) form.append(k, v);
      return api.upload(`/api/places/${encodeURIComponent(place.id)}/stamps`, CreateStampResponse, form, { onProgress: setProgress });
    },
    onSuccess: (res) => {
      haptics.success();
      setDone(true);
      photoDraft.clear();
      landingDraft.set(res.stamp, res.progress);
      for (const key of [["feed"], ["user"], qk.neighborhoods, qk.pins]) void queryClient.invalidateQueries({ queryKey: key });
      requestAnimationFrame(() => router.replace("/stamp/landed"));
    },
    onError: () => haptics.warning(),
  });

  const problem = stampProblem(draft, place?.id ?? null);
  const readiness = stampReadiness({ place, problem, busy: stamp.isPending });

  const resetToPlaces = () => {
    Keyboard.dismiss();
    photoDraft.clear();
    setCaption("");
    setSong(null);
    setProgress(0);
    setActivePhoto(0);
    setViewingPhoto(null);
    setChosenId(null);
    setChoosingPlace(true);
    setStampAt(Date.now());
  };

  const returnToPlaces = () => {
    Keyboard.dismiss();
    if (!dirty) {
      resetToPlaces();
      return;
    }
    Alert.alert("Discard this stamp?", "The photos, caption and song you've added will be removed.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: resetToPlaces },
    ]);
  };

  const cancel = () => {
    Keyboard.dismiss();
    if (place) {
      returnToPlaces();
      return;
    }
    router.back();
  };

  const removeActivePhoto = () => {
    photoDraft.remove(currentPhoto);
    setActivePhoto(Math.max(0, Math.min(currentPhoto, photoUris.length - 2)));
  };
  const viewerPhotos = photoUris.map((uri, index) => ({ id: `${uri}-${index}`, uri }));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollBeginDrag={Keyboard.dismiss}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]}
      >
        <View style={[styles.topbar, place && styles.topbarWithBack]}>
          {place ? (
            <Pressable onPress={returnToPlaces} accessibilityRole="button" accessibilityLabel="Back to places" style={styles.backTarget}>
              <Icon name="chevron.left" color="textPrimary" size={22} />
            </Pressable>
          ) : null}
          <Pressable onPress={cancel} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.cancelTarget}>
            <Kicker>CANCEL</Kicker>
          </Pressable>
        </View>

        {place ? (
          <>
            <NativeText style={styles.title}>Make it{`\n`}a memory.</NativeText>
            <NativeText style={styles.placeKicker}>{place.name.toUpperCase()} · YOU&apos;RE HERE</NativeText>

            <View style={styles.photoStage}>
              {photoUris.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  bounces={photoUris.length > 1}
                  onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}
                >
                  {photoUris.map((uri, index) => (
                    <Pressable
                      key={`${uri}-${index}`}
                      onPress={() => {
                        Keyboard.dismiss();
                        setViewingPhoto(index);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Open photo ${index + 1} of ${photoUris.length}`}
                      style={[styles.photoPage, { width: photoWidth }]}
                    >
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photo ${index + 1} of ${photoUris.length}`} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Pressable style={styles.emptyPhoto} onPress={openPhotos} accessibilityRole="button" accessibilityLabel="Add a photo">
                  <Icon name="camera.fill" color="accent" size={30} />
                  <Text variant="callout" color="textSecondary">Add a photo</Text>
                </Pressable>
              )}
              {photoUris.length > 0 ? (
                <>
                  <View style={styles.photoCount}><Kicker>{photoUris.length} / {MAX_STAMP_PHOTOS}</Kicker></View>
                  <Pressable onPress={removeActivePhoto} accessibilityRole="button" accessibilityLabel={`Remove photo ${currentPhoto + 1}`} style={styles.removePhoto}>
                    <Icon name="xmark" color="textPrimary" size={20} />
                  </Pressable>
                  {photoUris.length > 1 ? (
                    <View style={styles.photoDots} pointerEvents="none">
                      {photoUris.map((uri, index) => <View key={`${uri}-dot-${index}`} style={[styles.dot, index === currentPhoto && styles.dotActive]} />)}
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>

            {photoUris.length < MAX_STAMP_PHOTOS ? <EditorialButton label={photoUris.length === 0 ? "+  Add a photo" : "+  Add another photo"} outline onPress={openPhotos} /> : null}

            <View style={styles.captionBlock}>
              <Kicker>A FEW WORDS</Kicker>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                maxLength={CAPTION_MAX}
                placeholder="An afternoon worth keeping."
                placeholderTextColor={colors.textSecondary}
                multiline
                inputAccessoryViewID={CAPTION_ACCESSORY_ID}
                style={styles.captionInput}
                accessibilityLabel="A few words"
              />
              <NativeText style={styles.counter}>{caption.length} / {CAPTION_MAX}</NativeText>
            </View>

            <Rule />
            {song ? (
              <View style={styles.songWrap}>
                <SongRow song={song} trailing={<Pressable onPress={() => setSong(null)} accessibilityRole="button" accessibilityLabel="Remove song" style={styles.hitTarget}><Icon name="xmark" color="textSecondary" size={18} /></Pressable>} />
              </View>
            ) : (
              <Pressable style={styles.songAction} onPress={() => { Keyboard.dismiss(); router.push("/stamp/song"); }} accessibilityRole="button">
                <Icon name="music.note" color="textPrimary" size={23} />
                <NativeText style={styles.songLabel}>Add a song</NativeText>
              </Pressable>
            )}
            <Rule />

            {readiness.calm ? (
              <View style={styles.notice}>
                <Text variant="callout" color="textSecondary">{readiness.calm.title}. {readiness.calm.body}</Text>
              </View>
            ) : null}
            {readiness.hint && !stamp.isPending ? <Text variant="footnote" color="textTertiary">{readiness.hint}</Text> : null}
            {stamp.error ? <InlineError message={errorText(stamp.error, "Couldn't stamp that. Try again.")} onRetry={() => stamp.mutate()} retrying={stamp.isPending} /> : null}
            <EditorialButton
              label={stamp.isPending ? `Stamping…${photoUris.length ? ` ${Math.round(progress * 100)}%` : ""}` : "Stamp this place"}
              disabled={!readiness.ready}
              onPress={() => {
                Keyboard.dismiss();
                haptics.select();
                stamp.mutate();
              }}
            />
            <NativeText style={styles.confirmed}>Location confirmed · {place.neighborhood}, New York</NativeText>
          </>
        ) : (
          <PlacePicker
            permission={permission}
            coordsReady={!!coords}
            nearbyPending={nearby.isPending}
            nearbyError={nearby.isError}
            retry={() => void nearby.refetch()}
            places={places}
            onChoose={(id) => {
              setChosenId(id);
              setChoosingPlace(false);
              setStampAt(Date.now());
            }}
          />
        )}
      </ScrollView>
      <InputAccessoryView nativeID={CAPTION_ACCESSORY_ID}>
        <View style={styles.keyboardAccessory}>
          <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Done editing caption" style={styles.keyboardDone}>
            <Text variant="callout" color="accent" weight="semibold">Done</Text>
          </Pressable>
        </View>
      </InputAccessoryView>
      <PhotoViewer photos={viewerPhotos} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </View>
  );
}

function PlacePicker({ permission, coordsReady, nearbyPending, nearbyError, retry, places, onChoose }: { permission: string; coordsReady: boolean; nearbyPending: boolean; nearbyError: boolean; retry: () => void; places: Nearby[]; onChoose: (id: string) => void }) {
  const sections = placeSections(places);
  return (
    <View style={styles.picker}>
      <NativeText style={styles.title}>Where are{`\n`}you?</NativeText>
      <SimulatedLocationChip />
      {permission !== "granted" && !coordsReady ? (
        <View style={styles.notice}>
          <Text variant="callout" color="textSecondary">Nostos checks that you&apos;re at a place before it gives you a stamp.</Text>
          <Button title={permission === "denied" ? "Open settings" : "Use my location"} variant="secondary" onPress={() => router.push("/location-permission")} />
        </View>
      ) : nearbyPending || !coordsReady ? (
        <SkeletonRows count={3} />
      ) : nearbyError ? (
        <InlineError message="Couldn't find places near you." onRetry={retry} />
      ) : places.length === 0 ? (
        <Text variant="callout" color="textSecondary">No places near you yet. Nostos stamps places in New York.</Text>
      ) : (
        sections.map((group) => (
          <ListGroup key={group.title} header={group.title}>
            {group.places.map((p) => {
              const row = placeRowText(p);
              return <ListRow key={p.id} icon="location" iconColor="accent" title={row.title} subtitle={row.subtitle} accessibilityLabel={row.spoken} onPress={() => onChoose(p.id)} />;
            })}
          </ListGroup>
        ))
      )}
      {__DEV__ && devSimulator ? <DevPlaces /> : null}
    </View>
  );
}

function DevPlaces() {
  const places = usePlaces();
  if (!devSimulator) return null;
  return (
    <ListGroup header="Development: pretend to be at">
      {(places.data?.places ?? []).slice(0, 6).map((p) => <ListRow key={p.id} icon="location.slash" title={p.name} subtitle={p.neighborhood} onPress={() => devSimulator?.set({ lat: p.lat, lng: p.lng })} />)}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 4, gap: 12 },
  topbar: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginHorizontal: -7 },
  topbarWithBack: { justifyContent: "space-between" },
  backTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  cancelTarget: { minWidth: 64, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 68, lineHeight: 68, letterSpacing: -1.5, marginTop: 0, paddingTop: 2 },
  placeKicker: { color: colors.accent, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.35, marginTop: 2 },
  photoStage: { height: 259, backgroundColor: colors.elevated, overflow: "hidden", position: "relative" },
  photoPage: { height: 259, backgroundColor: colors.elevated },
  emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  photoCount: { position: "absolute", right: 62, top: 8, height: 28, minWidth: 50, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  removePhoto: { position: "absolute", right: 8, top: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  photoDots: { position: "absolute", left: 0, right: 0, bottom: 10, flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary, opacity: 0.55 },
  dotActive: { backgroundColor: colors.accent, opacity: 1 },
  captionBlock: { gap: 5, marginTop: 2 },
  captionInput: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 0, paddingVertical: 10 },
  counter: { color: colors.textSecondary, fontSize: 11, alignSelf: "flex-end" },
  keyboardAccessory: { minHeight: 44, backgroundColor: colors.elevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 16 },
  keyboardDone: { minWidth: 56, minHeight: 40, alignItems: "center", justifyContent: "center" },
  songAction: { height: 46, flexDirection: "row", alignItems: "center", gap: 12 },
  songLabel: { color: colors.textPrimary, fontSize: 14 },
  songWrap: { minHeight: 54, justifyContent: "center" },
  notice: { paddingVertical: 8, gap: 8 },
  confirmed: { color: colors.textSecondary, fontSize: 11, lineHeight: 14 },
  picker: { gap: 14 },
});
