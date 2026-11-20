import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, type ScrollViewInstance, StyleSheet, Text as NativeText, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
import { CreateStampResponse, type Place, type Song } from "@/api/contracts";
import { qk } from "@/api/keys";
import { useCollections, useNearbyPlaces, usePlaceSearch } from "@/api/queries";
import { EditorialButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PhotoViewer } from "@/features/book/PhotoViewer";
import { locationStore, useLocationState, usePermissionRefresh, useUserCoords } from "@/features/location/location-store";
import { CAPTION_MAX, stampFields, stampProblem, type StampMode } from "@/features/stamps/composer";
import { landingDraft } from "@/features/stamps/landing-draft";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { placeDraft } from "@/features/stamps/place-draft";
import { useRevealAboveKeyboard } from "@/features/stamps/reveal-above-keyboard";
import { songDraft } from "@/features/stamps/song-draft";
import { MAX_STAMP_PHOTOS, stampReadiness } from "@/features/stamps/stamp-flow";
import { hasStampArtwork, StampPreview } from "@/features/stamps/StampPreview";
import { RemoveSongButton, SongRow } from "@/features/stamps/song-row";
import { useVisitDateField, visitDateText } from "@/features/stamps/visit-date";
import { formatDistance } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { localityLabel } from "@/lib/place";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, fonts, maxFontSizeMultiplier, radius, screenPadding, size, space } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";
import { DismissKeyboard } from "@/components/ui/dismiss-keyboard";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";

/** With location on but no GPS fix after this long, stop showing the Nearby skeleton and suggest searching. */
const LOCATE_PATIENCE_MS = 8000;
/** The caption counter turns to the accent this many characters before the limit (P-090). */
const CAPTION_WARN_LEFT = 20;

const providerKey = (place: Place) => place.googlePlaceId ?? place.id;
const cuisineText = (place: Place, count = 2) => place.cuisines.slice(0, count).join(" · ");
const placeSubtitle = (place: Place) => [cuisineText(place), localityLabel(place)].filter(Boolean).join(" · ");

export default function NewStamp() { return <Composer />; }

function Composer() {
  usePermissionRefresh();
  useEffect(() => () => photoDraft.clear(), []);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { permission } = useLocationState();
  const coords = useUserCoords();
  const nearby = useNearbyPlaces(coords);
  const collections = useCollections();
  const [mode, setMode] = useState<StampMode>("now");
  const [now] = useState(Date.now);
  const todayText = visitDateText(new Date(now));
  const visitDate = useVisitDateField(todayText, now);
  const [search, setSearch] = useState("");
  const searchResults = usePlaceSearch(search, coords);
  const [place, setPlace] = useState<Place | null>(() => placeDraft.take());
  const photoUris = usePhotoDraft();
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [locateGaveUp, setLocateGaveUp] = useState(false);
  const submitting = useRef(false);
  const keyboardUp = useKeyboardVisible(800);
  const scroller = useRef<ScrollViewInstance>(null);
  const reveal = useRevealAboveKeyboard(scroller);
  const placeSectionY = useRef(0);
  const captionY = useRef(0);
  const photoScroller = useRef<ScrollViewInstance>(null);
  const photoWidth = Math.max(1, width - screenPadding * 2);
  const currentPhoto = photoUris.length > 0 ? Math.min(activePhoto, photoUris.length - 1) : 0;

  const nearMatch = place ? nearby.data?.places.find((candidate) => providerKey(candidate) === providerKey(place)) ?? null : null;
  const pastDate = visitDate.check.ok ? visitDate.check.date : null;
  const dateProblem = mode === "past" && !visitDate.check.ok ? visitDate.check.message : null;
  const previewVisitedAt = (mode === "past" && pastDate ? pastDate : new Date(now)).toISOString();
  const previewSize = Math.min(300, Math.max(220, width - 72));
  const draft = { photoUris, caption, song };
  // Only real content counts. Picking PAST on its own, or leaving today's date, is not worth a discard prompt (P-088).
  const dirty = !done && (place !== null || photoUris.length > 0 || caption.trim() !== "" || song !== null || collectionIds.length > 0 || (mode === "past" && visitDate.text !== todayText));
  const { leave, allowLeave } = useConfirmDiscard(dirty, { quietGestures: keyboardUp, title: "Discard this stamp?", message: "Nothing has been saved yet." });

  const openPhotos = () => { if (!place) return; Keyboard.dismiss(); nav.push("/stamp/camera"); };
  useFocusEffect(useCallback(() => { const picked = songDraft.take(); if (picked) setSong(picked.song); }, []));

  // Location on but no fix yet: show the Nearby skeleton for a while, then fall back to "search by name" (P-097).
  const waitingForFix = permission === "granted" && !coords;
  useEffect(() => {
    if (!waitingForFix) return;
    const t = setTimeout(() => setLocateGaveUp(true), LOCATE_PATIENCE_MS);
    return () => clearTimeout(t);
  }, [waitingForFix]);

  // Leave only after `done` (and the dropped discard block) has committed, so "Discard this stamp?" can't flash (P-087).
  useEffect(() => { if (done) router.replace("/stamp/landed"); }, [done]);

  const stamp = useMutation({
    onSettled: () => { submitting.current = false; },
    mutationFn: async () => {
      if (!place) throw new Error("no place");
      const here = mode === "now" ? ((await locationStore.currentForPosting()) ?? coords) : null;
      const visit = mode === "past" ? pastDate! : new Date();
      const form = new FormData();
      for (const [i, uri] of photoUris.entries()) form.append("photos", { uri, name: `photo-${i + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
      for (const [k, v] of stampFields(draft, mode, visit, here)) form.append(k, v);
      for (const collectionId of collectionIds) form.append("collectionId", collectionId);
      return api.upload(`/api/places/${encodeURIComponent(place.id)}/stamps`, CreateStampResponse, form, { onProgress: setProgress });
    },
    onSuccess: (res) => {
      haptics.success(); allowLeave(); setDone(true); photoDraft.clear(); landingDraft.set(res.stamp);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: qk.collections });
    },
    onError: () => haptics.warning(),
  });

  const problem = dateProblem ?? stampProblem(draft, place?.id ?? null);
  const readiness = stampReadiness({ problem, busy: stamp.isPending });
  const verifiedEligible = mode === "now" && permission === "granted" && nearMatch?.inside === true;
  const resetPlace = () => { Keyboard.dismiss(); setPlace(null); setSearch(""); stamp.reset(); };
  const choosePlace = (next: Place) => { Keyboard.dismiss(); setPlace(next); stamp.reset(); };
  // isPending only flips after a re-render, so two taps in one frame would both submit. Guard synchronously.
  const submitStamp = () => { if (submitting.current || done) return; submitting.current = true; stamp.mutate(); };
  // After a removal the carousel must show the photo the next X will remove: stay on the same slot (now the next
  // photo), or step back when the last one was removed, and move the scroll position to match.
  const removeCurrentPhoto = () => {
    const nextIndex = Math.max(0, Math.min(currentPhoto, photoUris.length - 2));
    photoDraft.remove(currentPhoto);
    setActivePhoto(nextIndex);
    photoScroller.current?.scrollTo({ x: nextIndex * photoWidth, animated: false });
  };
  const toggleCollection = (id: string) => setCollectionIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const searchText = search.trim();
  const searching = searchText.length >= 2;
  const results = searching ? (searchResults.data?.places ?? []) : [];

  // Nearby stays up until a search has two characters (P-077). "unknown" permission renders nothing yet (P-097).
  const nearbyMode = mode === "now" && !searching;
  const nearbyPlaces = nearbyMode && coords ? (nearby.data?.places ?? []) : [];
  const herePlaces = nearbyPlaces.filter((candidate) => candidate.inside);
  const aroundPlaces = nearbyPlaces.filter((candidate) => !candidate.inside);
  const nearbyLoading = nearbyMode && permission === "granted" && (coords ? nearby.isPending : !locateGaveUp);
  const nearbyEmpty = nearbyMode && !!coords && nearby.isSuccess && nearbyPlaces.length === 0;
  const suggestSearch = !searching && (mode === "past" || permission === "denied" || permission === "undetermined" || (waitingForFix && locateGaveUp));
  const showLocationNotice = mode === "now" && (permission === "denied" || permission === "undetermined");
  const captionNearLimit = caption.length >= CAPTION_MAX - CAPTION_WARN_LEFT;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onScrollBeginDrag={Keyboard.dismiss} automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.topbar, place && styles.topbarWithBack]}>{place ? <Tappable onPress={resetPlace} accessibilityRole="button" accessibilityLabel="Back to places" style={styles.backTarget}><Icon name="chevron.left" color="textPrimary" size={size.icon} /></Tappable> : null}<Tappable onPress={leave} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.cancelTarget}><Kicker>CANCEL</Kicker></Tappable></View>

        {!place ? <>
          <DismissKeyboard><NativeText style={styles.title}>Make a{`\n`}new stamp.</NativeText></DismissKeyboard><Kicker>WHEN DID THIS HAPPEN?</Kicker>
          <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="When did this happen?">
            <Tappable style={[styles.modeCard, mode === "now" && styles.modeCardActive]} onPress={() => setMode("now")} accessibilityRole="radio" accessibilityLabel="Now. I'm here now. Location can verify the visit." accessibilityState={{ checked: mode === "now" }}><NativeText style={[styles.modeTitle, mode === "now" && styles.modeTitleActive]}>NOW</NativeText><Text variant="footnote" color={mode === "now" ? "onAccent" : "textSecondary"}>I&apos;m here now. Location can verify the visit.</Text></Tappable>
            <Tappable style={[styles.modeCard, mode === "past" && styles.modeCardActive]} onPress={() => setMode("past")} accessibilityRole="radio" accessibilityLabel="Past. Add a memory from the last year." accessibilityState={{ checked: mode === "past" }}><NativeText style={[styles.modeTitle, mode === "past" && styles.modeTitleActive]}>PAST</NativeText><Text variant="footnote" color={mode === "past" ? "onAccent" : "textSecondary"}>Add a memory from the last year.</Text></Tappable>
          </View>
          {mode === "past" ? (
            <View style={styles.dateBlock}>
              <Kicker>VISIT DATE · MM/DD/YYYY</Kicker>
              <TextInput value={visitDate.text} onChangeText={visitDate.setText} onBlur={visitDate.onBlur} {...visitDate.inputProps} placeholderTextColor={colors.textTertiary} selectionColor={colors.accent} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.dateInput, visitDate.error && styles.dateInputInvalid]} accessibilityLabel="Visit date" accessibilityHint="Up to one year ago, not in the future" />
              {visitDate.error ? <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">{visitDate.error}</Text> : <Text variant="footnote" color="textTertiary">Any day in the last year. Past stamps aren&apos;t location verified.</Text>}
            </View>
          ) : showLocationNotice ? (
            <View style={styles.notice}><Text variant="callout" color="textSecondary">You can stamp without sharing location. It just won&apos;t show as verified.</Text><Button title={permission === "denied" ? "Location settings" : "Use my location"} variant="secondary" onPress={() => nav.push("/location-permission")} /></View>
          ) : null}
          <Rule />
          <View onLayout={(event) => { placeSectionY.current = event.nativeEvent.layout.y; }}><NativeText style={styles.sectionTitle}>Choose a place</NativeText></View>
          <TextInput value={search} onChangeText={setSearch} onFocus={() => reveal(placeSectionY.current)} returnKeyType="search" autoCorrect={false} spellCheck={false} clearButtonMode="while-editing" selectionColor={colors.accent} maxFontSizeMultiplier={maxFontSizeMultiplier} placeholder="Search restaurants, bars & hotels" placeholderTextColor={colors.textTertiary} style={styles.searchInput} accessibilityLabel="Search restaurants, bars and hotels" />
          {searchText.length === 1 ? <Text variant="footnote" color="textTertiary">Keep typing to search.</Text> : null}
          {nearbyLoading ? <SkeletonRows count={3} /> : null}
          {herePlaces.length > 0 ? <ListGroup header="You're here · visit can be verified">{herePlaces.map((candidate) => <ListRow key={providerKey(candidate)} icon="checkmark.seal.fill" iconColor="accent" title={candidate.name} subtitle={cuisineText(candidate) || undefined} onPress={() => choosePlace(candidate)} />)}</ListGroup> : null}
          {aroundPlaces.length > 0 ? <ListGroup header="Nearby">{aroundPlaces.map((candidate) => <ListRow key={providerKey(candidate)} icon="location" iconColor="accent" title={candidate.name} subtitle={[cuisineText(candidate), `${formatDistance(candidate.distanceM)} away`].filter(Boolean).join(" · ")} onPress={() => choosePlace(candidate)} />)}</ListGroup> : null}
          {nearbyPlaces.length > 0 ? <Text variant="footnote" color="textTertiary">Google Maps</Text> : null}
          {nearbyEmpty ? <Text variant="callout" color="textSecondary">No restaurants, bars or hotels nearby. Search by name instead.</Text> : null}
          {searching && searchResults.isPending ? <SkeletonRows count={4} /> : null}
          {searching && results.length > 0 ? <><ListGroup header="Results">{results.map((candidate) => <ListRow key={providerKey(candidate)} icon="location" title={candidate.name} subtitle={placeSubtitle(candidate) || candidate.address} onPress={() => choosePlace(candidate)} />)}</ListGroup><Text variant="footnote" color="textTertiary">Google Maps</Text></> : null}
          {searching && searchResults.isSuccess && results.length === 0 ? <Text variant="callout" color="textSecondary">No restaurants, bars or hotels found. Try another search.</Text> : null}
          {suggestSearch && !searchText ? <Text variant="callout" color="textSecondary">Search for a restaurant, bar or hotel by name.</Text> : null}
          {nearby.isError && nearbyMode && coords ? <InlineError message="Couldn't load places nearby." onRetry={() => void nearby.refetch()} /> : null}
          {searchResults.isError && searching ? <InlineError message="Couldn't search places." onRetry={() => void searchResults.refetch()} /> : null}
        </> : <>
          <DismissKeyboard><NativeText style={styles.title}>Make it{`\n`}a memory.</NativeText></DismissKeyboard><NativeText style={styles.placeKicker} numberOfLines={2}>{place.name.toUpperCase()} · {mode === "past" ? (pastDate ? visitDateText(pastDate) : visitDate.text) : "TODAY"}</NativeText>
          {place.cuisines.length > 0 ? <Text variant="footnote" color="textSecondary" numberOfLines={2}>{cuisineText(place, 3)}</Text> : null}
          {hasStampArtwork(place) ? <View style={styles.previewBlock}><Kicker>STAMP PREVIEW</Kicker><View style={styles.previewArt}><StampPreview place={place} visitedAt={previewVisitedAt} photoUri={photoUris[0] ?? null} size={previewSize} /></View><Text variant="footnote" color="textTertiary" align="center">The first photo becomes the image on your stamp.</Text></View> : null}
          {verifiedEligible ? <View style={styles.verifiedNotice}><Icon name="checkmark.seal.fill" color="accent" size={size.icon} /><Text variant="callout" color="accent" weight="semibold">Visit eligible for Nostos verification</Text></View> : <Text variant="footnote" color="textTertiary">This visit will be unverified unless Nostos can confirm you&apos;re at the place when you stamp.</Text>}
          <View style={styles.photoStage}>
            {photoUris.length > 0 ? <ScrollView ref={photoScroller} horizontal pagingEnabled nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} bounces={photoUris.length > 1} onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}>{photoUris.map((uri, index) => <Tappable key={`${uri}-${index}`} onPress={() => setViewingPhoto(index)} accessibilityRole="button" accessibilityLabel={`Open photo ${index + 1} of ${photoUris.length}`} style={[styles.photoPage, { width: photoWidth }]}><Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /></Tappable>)}</ScrollView> : <Tappable style={styles.emptyPhoto} onPress={openPhotos} accessibilityRole="button" accessibilityLabel="Add photos"><Icon name="camera.fill" color="accent" size={size.iconLarge} /><Text variant="callout" color="textSecondary">Add photos</Text><Text variant="footnote" color="textTertiary">Up to {MAX_STAMP_PHOTOS}</Text></Tappable>}
            {photoUris.length > 0 ? <>
              <View style={styles.photoCount} accessible={false} importantForAccessibility="no-hide-descendants"><NativeText style={styles.photoCountText}>{currentPhoto + 1} of {photoUris.length}</NativeText></View>
              {photoUris.length > 1 ? <View style={styles.dots} accessible={false} importantForAccessibility="no-hide-descendants">{photoUris.map((uri, index) => <View key={`${uri}-${index}`} style={[styles.dot, index === currentPhoto && styles.dotActive]} />)}</View> : null}
              <Tappable onPress={removeCurrentPhoto} accessibilityRole="button" accessibilityLabel={`Remove photo ${currentPhoto + 1}`} style={styles.removePhoto}><View style={styles.removePhotoDisc}><Icon name="xmark" color="onAccent" size={size.iconSmall} /></View></Tappable>
            </> : null}
          </View>
          {photoUris.length > 0 && photoUris.length < MAX_STAMP_PHOTOS ? <EditorialButton label="+  Add more photos" outline onPress={openPhotos} /> : null}
          {photoUris.length >= MAX_STAMP_PHOTOS ? <Text variant="footnote" color="textTertiary">{MAX_STAMP_PHOTOS} of {MAX_STAMP_PHOTOS} photos. Remove one to add another.</Text> : null}
          <View style={styles.captionBlock} onLayout={(event) => { captionY.current = event.nativeEvent.layout.y; }}><Kicker>A FEW WORDS</Kicker><TextInput value={caption} onChangeText={setCaption} onFocus={() => reveal(captionY.current)} maxLength={CAPTION_MAX} placeholder="An afternoon worth keeping." placeholderTextColor={colors.textSecondary} selectionColor={colors.accent} maxFontSizeMultiplier={maxFontSizeMultiplier} multiline inputAccessoryViewButtonLabel="Done" returnKeyType="done" submitBehavior="blurAndSubmit" style={styles.captionInput} accessibilityLabel="A few words" /><Text variant="caption" color={captionNearLimit ? "accent" : "textTertiary"} align="right" accessibilityLabel={`${caption.length} of ${CAPTION_MAX} characters`}>{caption.length} / {CAPTION_MAX}</Text></View><Rule />
          {song ? <View style={styles.songWrap}><SongRow song={song} trailing={<RemoveSongButton onPress={() => setSong(null)} />} /></View> : <Tappable style={styles.songAction} onPress={() => { Keyboard.dismiss(); nav.push("/stamp/song"); }} accessibilityRole="button"><Icon name="music.note" color="textPrimary" size={size.icon} /><Text variant="callout">Add a song</Text></Tappable>}
          {(collections.data?.collections.length ?? 0) > 0 ? <><Rule /><View style={styles.collectionBlock}><Kicker>ADD TO COLLECTIONS · OPTIONAL</Kicker>{collections.data!.collections.map((collection) => { const selected = collectionIds.includes(collection.id); return <Tappable key={collection.id} onPress={() => toggleCollection(collection.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={styles.collectionRow}><Icon name={selected ? "checkmark.circle.fill" : "circle"} color={selected ? "accent" : "textTertiary"} size={size.icon} /><View style={styles.collectionText}><Text variant="body" weight="semibold">{collection.name}</Text><Text variant="footnote" color="textSecondary">{collection.stampCount} {collection.stampCount === 1 ? "stamp" : "stamps"}</Text></View></Tappable>; })}</View></> : null}
          <Rule />{readiness.hint && !stamp.isPending ? <Text variant="footnote" color="textTertiary">{readiness.hint}</Text> : null}{stamp.error ? <InlineError message={errorText(stamp.error, "Couldn't stamp that. Try again.")} onRetry={submitStamp} retrying={stamp.isPending} /> : null}<EditorialButton label={stamp.isPending ? `Stamping…${photoUris.length ? ` ${Math.round(progress * 100)}%` : ""}` : "Stamp this place"} loading={stamp.isPending} disabled={!readiness.ready} onPress={() => { if (submitting.current) return; Keyboard.dismiss(); haptics.select(); submitStamp(); }} />
        </>}
      </ScrollView>
      <PhotoViewer photos={photoUris.map((uri, index) => ({ id: `${uri}-${index}`, uri }))} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </View>
  );
}

const PHOTO_STAGE = 301;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: screenPadding, gap: 14, paddingTop: space.xxs }, topbar: { minHeight: 50, alignItems: "flex-end", justifyContent: "center" }, topbarWithBack: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backTarget: { width: size.hitTarget, height: size.hitTarget, marginLeft: -10, alignItems: "center", justifyContent: "center" }, cancelTarget: { minWidth: 64, height: size.hitTarget, alignItems: "flex-end", justifyContent: "center" }, title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 64, lineHeight: 58, letterSpacing: -2 }, sectionTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 36, lineHeight: 39 }, modeRow: { flexDirection: "row", gap: 10 }, modeCard: { flex: 1, minHeight: 118, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textTertiary, padding: 14, gap: space.xs, justifyContent: "space-between" }, modeCardActive: { backgroundColor: colors.accent, borderColor: colors.accent }, modeTitle: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 15, letterSpacing: 1.5 }, modeTitleActive: { color: colors.onAccent }, dateBlock: { gap: 7 }, dateInput: { borderBottomWidth: 1, borderColor: colors.textPrimary, minHeight: 48, color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 20 }, dateInputInvalid: { borderColor: colors.danger }, searchInput: { minHeight: 50, borderBottomWidth: 1, borderColor: colors.textPrimary, color: colors.textPrimary, fontSize: 17 }, notice: { gap: 10, paddingVertical: space.xxs }, placeKicker: { color: colors.accent, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.7 }, previewBlock: { gap: 10, paddingVertical: 6 }, previewArt: { minHeight: 230, alignItems: "center", justifyContent: "center" }, verifiedNotice: { flexDirection: "row", alignItems: "center", gap: space.xs },
  photoStage: { height: PHOTO_STAGE, overflow: "hidden", backgroundColor: colors.elevated, position: "relative" }, photoPage: { height: PHOTO_STAGE, backgroundColor: colors.elevated }, emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xs },
  photoCount: { position: "absolute", left: space.sm, bottom: space.sm, backgroundColor: colors.background, paddingHorizontal: space.xs, paddingVertical: space.xxs }, photoCountText: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 10 },
  dots: { position: "absolute", left: 0, right: 0, bottom: space.md, flexDirection: "row", justifyContent: "center", gap: space.xxs },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: colors.onAccent, opacity: 0.55 }, dotActive: { opacity: 1 },
  // Same treatment as the photo controls on the Photos and Edit screens: scrim disc, light icon, full hit target (P-098).
  removePhoto: { position: "absolute", right: 0, top: 0, width: size.hitTarget + space.xs, height: size.hitTarget + space.xs, alignItems: "center", justifyContent: "center" }, removePhotoDisc: { width: size.avatar, height: size.avatar, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  captionBlock: { gap: space.xxs }, captionInput: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 35, lineHeight: 39, minHeight: 86, paddingVertical: 5 }, songWrap: { paddingVertical: space.xxs }, songAction: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: space.sm }, collectionBlock: { gap: space.xs }, collectionRow: { minHeight: size.fieldHeight, flexDirection: "row", alignItems: "center", gap: space.md }, collectionText: { flex: 1, gap: space.xxs },
});
