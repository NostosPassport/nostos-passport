import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, useWindowDimensions, View } from "react-native";
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
import { songDraft } from "@/features/stamps/song-draft";
import { MAX_STAMP_PHOTOS, stampReadiness } from "@/features/stamps/stamp-flow";
import { SongRow } from "@/features/stamps/song-row";
import { formatBirthdateInput } from "@/lib/age";
import { haptics } from "@/lib/haptics";
import { formatDistance } from "@/lib/format";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, fonts } from "@/theme";

const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;
function dateText(d: Date) { return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`; }
function parseDate(value: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

const providerKey = (place: Place) => place.googlePlaceId ?? place.id;
const cuisineText = (place: Place) => place.cuisines.slice(0, 2).join(" · ");
const placeSubtitle = (place: Place) => [cuisineText(place), place.neighborhood].filter(Boolean).join(" · ");

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
  const [pastDateText, setPastDateText] = useState(() => dateText(new Date()));
  const [search, setSearch] = useState("");
  const searchResults = usePlaceSearch(search, coords);
  const [place, setPlace] = useState<Place | null>(null);
  const photoUris = usePhotoDraft();
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [stampSaved, setStampSaved] = useState(false);
  const createdStamp = useRef<CreateStampResponse | null>(null);
  const [now] = useState(Date.now);
  const photoWidth = Math.max(1, width - 48);
  const currentPhoto = photoUris.length > 0 ? Math.min(activePhoto, photoUris.length - 1) : 0;

  const nearMatch = place ? nearby.data?.places.find((candidate) => providerKey(candidate) === providerKey(place)) ?? null : null;
  const pastDate = parseDate(pastDateText);
  const dateProblem = mode === "past" && (!pastDate || pastDate.getTime() > now || pastDate.getTime() < now - ONE_YEAR_MS) ? "Choose a date from the last year, not in the future." : null;
  const draft = { photoUris, caption, song };
  const dirty = !done && (place !== null || photoUris.length > 0 || caption.trim() !== "" || song !== null || collectionIds.length > 0 || mode === "past");
  useConfirmDiscard(dirty);

  const openPhotos = () => { if (!place) return; Keyboard.dismiss(); router.push("/stamp/camera"); };
  useFocusEffect(useCallback(() => { const picked = songDraft.take(); if (picked) setSong(picked.song); }, []));

  const stamp = useMutation({
    mutationFn: async () => {
      if (!place) throw new Error("no place");
      let result = createdStamp.current;
      if (!result) {
        const here = mode === "now" ? ((await locationStore.currentForPosting()) ?? coords) : null;
        const visit = mode === "past" ? pastDate! : new Date();
        const form = new FormData();
        for (const [i, uri] of photoUris.entries()) form.append("photos", { uri, name: `photo-${i + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
        for (const [k, v] of stampFields(draft, mode, visit, here)) form.append(k, v);
        result = await api.upload(`/api/places/${encodeURIComponent(place.id)}/stamps`, CreateStampResponse, form, { onProgress: setProgress });
        createdStamp.current = result;
        setStampSaved(true);
      }
      if (collectionIds.length > 0) await api.collections.setForStamp(result.stamp.id, collectionIds);
      return result;
    },
    onSuccess: (res) => {
      createdStamp.current = null;
      setStampSaved(false);
      haptics.success(); setDone(true); photoDraft.clear(); landingDraft.set(res.stamp, res.progress);
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: qk.neighborhoods });
      void queryClient.invalidateQueries({ queryKey: qk.pins });
      void queryClient.invalidateQueries({ queryKey: qk.collections });
      requestAnimationFrame(() => router.replace("/stamp/landed"));
    },
    onError: () => haptics.warning(),
  });

  const problem = dateProblem ?? stampProblem(draft, place?.id ?? null);
  const readiness = stampReadiness({ problem, busy: stamp.isPending });
  const verifiedEligible = mode === "now" && permission === "granted" && nearMatch?.inside === true;
  const resetPlace = () => { Keyboard.dismiss(); setPlace(null); setSearch(""); createdStamp.current = null; setStampSaved(false); stamp.reset(); };
  const choosePlace = (next: Place) => { Keyboard.dismiss(); setPlace(next); createdStamp.current = null; setStampSaved(false); stamp.reset(); };
  const toggleCollection = (id: string) => setCollectionIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const searching = search.trim().length >= 2;
  const results = searching ? (searchResults.data?.places ?? []) : [];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" onScrollBeginDrag={Keyboard.dismiss} automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.topbar, place && styles.topbarWithBack]}>{place ? <Pressable onPress={resetPlace} accessibilityRole="button" accessibilityLabel="Back to places" style={styles.backTarget}><Icon name="chevron.left" color="textPrimary" size={22} /></Pressable> : null}<Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.cancelTarget}><Kicker>CANCEL</Kicker></Pressable></View>

        {!place ? <>
          <NativeText style={styles.title}>Make a{`\n`}new stamp.</NativeText><Kicker>WHEN DID THIS HAPPEN?</Kicker>
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeCard, mode === "now" && styles.modeCardActive]} onPress={() => setMode("now")} accessibilityRole="button" accessibilityState={{ selected: mode === "now" }}><NativeText style={[styles.modeTitle, mode === "now" && styles.modeTitleActive]}>NOW</NativeText><Text variant="footnote" color={mode === "now" ? "onAccent" : "textSecondary"}>I&apos;m here now. Location can verify the visit.</Text></Pressable>
            <Pressable style={[styles.modeCard, mode === "past" && styles.modeCardActive]} onPress={() => setMode("past")} accessibilityRole="button" accessibilityState={{ selected: mode === "past" }}><NativeText style={[styles.modeTitle, mode === "past" && styles.modeTitleActive]}>PAST</NativeText><Text variant="footnote" color={mode === "past" ? "onAccent" : "textSecondary"}>Add a memory from the last year.</Text></Pressable>
          </View>
          {mode === "past" ? <View style={styles.dateBlock}><Kicker>VISIT DATE · MM/DD/YYYY</Kicker><TextInput value={pastDateText} onChangeText={(value) => setPastDateText(formatBirthdateInput(value))} keyboardType="number-pad" maxLength={10} placeholder="MM/DD/YYYY" placeholderTextColor={colors.textTertiary} style={styles.dateInput} accessibilityLabel="Visit date" />{dateProblem ? <Text variant="footnote" color="danger">{dateProblem}</Text> : <Text variant="footnote" color="textTertiary">Past stamps are not location verified.</Text>}</View> : permission !== "granted" ? <View style={styles.notice}><Text variant="callout" color="textSecondary">You can stamp without sharing location. It just won&apos;t show as verified.</Text><Button title={permission === "denied" ? "Location settings" : "Use my location"} variant="secondary" onPress={() => router.push("/location-permission")} /></View> : null}
          <Rule /><NativeText style={styles.sectionTitle}>Choose a place</NativeText><TextInput value={search} onChangeText={setSearch} placeholder="Search restaurants & bars" placeholderTextColor={colors.textTertiary} style={styles.searchInput} accessibilityLabel="Search restaurants and bars" />
          {!search.trim() && mode === "now" && coords && nearby.isPending ? <SkeletonRows count={3} /> : null}
          {!search.trim() && mode === "now" && (nearby.data?.places.length ?? 0) > 0 ? <><ListGroup header="Nearby">{nearby.data!.places.map((candidate) => <ListRow key={providerKey(candidate)} icon={candidate.inside ? "checkmark.seal.fill" : "location"} iconColor="accent" title={candidate.name} subtitle={[placeSubtitle(candidate), candidate.inside ? "visit can be verified" : `${formatDistance(candidate.distanceM)} away`].filter(Boolean).join(" · ")} onPress={() => choosePlace(candidate)} />)}</ListGroup><Text variant="footnote" color="textTertiary">Google Maps</Text></> : null}
          {searching && searchResults.isPending ? <SkeletonRows count={4} /> : null}
          {searching && results.length > 0 ? <><ListGroup header="Results">{results.map((candidate) => <ListRow key={providerKey(candidate)} icon="location" title={candidate.name} subtitle={placeSubtitle(candidate) || candidate.address} onPress={() => choosePlace(candidate)} />)}</ListGroup><Text variant="footnote" color="textTertiary">Google Maps</Text></> : null}
          {searching && searchResults.isSuccess && results.length === 0 ? <Text variant="callout" color="textSecondary">No restaurants or bars found. Try another search.</Text> : null}
          {!searching && !search.trim() && (!coords || mode === "past") ? <Text variant="callout" color="textSecondary">Search by restaurant or bar name. Nostos will look it up when you need it.</Text> : null}
          {nearby.isError && !search.trim() && mode === "now" ? <InlineError message="Couldn't load nearby restaurants and bars." onRetry={() => void nearby.refetch()} /> : null}
          {searchResults.isError && searching ? <InlineError message="Couldn't search restaurants and bars." onRetry={() => void searchResults.refetch()} /> : null}
        </> : <>
          <NativeText style={styles.title}>Make it{`\n`}a memory.</NativeText><NativeText style={styles.placeKicker}>{place.name.toUpperCase()} · {mode === "past" ? pastDateText : "TODAY"}</NativeText>
          {place.cuisines.length > 0 ? <Text variant="footnote" color="textSecondary">{place.cuisines.join(" · ")}</Text> : null}
          {verifiedEligible ? <View style={styles.verifiedNotice}><Icon name="checkmark.seal.fill" color="accent" size={20} /><Text variant="callout" color="accent" weight="semibold">Visit eligible for Nostos verification</Text></View> : <Text variant="footnote" color="textTertiary">This visit will be unverified unless Nostos can confirm you&apos;re at the place when you stamp.</Text>}
          <View style={styles.photoStage}>{photoUris.length > 0 ? <ScrollView horizontal pagingEnabled nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} bounces={photoUris.length > 1} onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}>{photoUris.map((uri, index) => <Pressable key={`${uri}-${index}`} onPress={() => setViewingPhoto(index)} accessibilityRole="button" accessibilityLabel={`Open photo ${index + 1} of ${photoUris.length}`} style={[styles.photoPage, { width: photoWidth }]}><Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /></Pressable>)}</ScrollView> : <Pressable style={styles.emptyPhoto} onPress={openPhotos} accessibilityRole="button" accessibilityLabel="Add a photo"><Icon name="camera.fill" color="accent" size={30} /><Text variant="callout" color="textSecondary">Add a photo</Text></Pressable>}{photoUris.length > 0 ? <><View style={styles.photoCount}><NativeText style={styles.photoCountText}>{photoUris.length} / {MAX_STAMP_PHOTOS}</NativeText></View><Pressable onPress={() => { photoDraft.remove(currentPhoto); setActivePhoto(Math.max(0, currentPhoto - 1)); }} accessibilityRole="button" accessibilityLabel={`Remove photo ${currentPhoto + 1}`} style={styles.removePhoto}><Icon name="xmark" color="textPrimary" size={20} /></Pressable></> : null}</View>
          {photoUris.length < MAX_STAMP_PHOTOS ? <EditorialButton label={photoUris.length === 0 ? "+  Add a photo" : "+  Add another photo"} outline onPress={openPhotos} /> : null}
          <View style={styles.captionBlock}><Kicker>A FEW WORDS</Kicker><TextInput value={caption} onChangeText={setCaption} maxLength={CAPTION_MAX} placeholder="An afternoon worth keeping." placeholderTextColor={colors.textSecondary} multiline inputAccessoryViewButtonLabel="Done" returnKeyType="done" submitBehavior="blurAndSubmit" style={styles.captionInput} accessibilityLabel="A few words" /><NativeText style={styles.counter}>{caption.length} / {CAPTION_MAX}</NativeText></View><Rule />
          {song ? <View style={styles.songWrap}><SongRow song={song} trailing={<Pressable onPress={() => setSong(null)} accessibilityRole="button" accessibilityLabel="Remove song" style={styles.hitTarget}><Icon name="xmark" color="textSecondary" size={18} /></Pressable>} /></View> : <Pressable style={styles.songAction} onPress={() => { Keyboard.dismiss(); router.push("/stamp/song"); }} accessibilityRole="button"><Icon name="music.note" color="textPrimary" size={23} /><NativeText style={styles.songLabel}>Add a song</NativeText></Pressable>}
          {(collections.data?.collections.length ?? 0) > 0 ? <><Rule /><View style={styles.collectionBlock}><Kicker>ADD TO COLLECTIONS · OPTIONAL</Kicker>{collections.data!.collections.map((collection) => { const selected = collectionIds.includes(collection.id); return <Pressable key={collection.id} onPress={() => toggleCollection(collection.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={styles.collectionRow}><Icon name={selected ? "checkmark.circle.fill" : "circle"} color={selected ? "accent" : "textTertiary"} size={22} /><View style={styles.collectionText}><Text variant="body" weight="semibold">{collection.name}</Text><Text variant="footnote" color="textSecondary">{collection.stampCount} {collection.stampCount === 1 ? "stamp" : "stamps"}</Text></View></Pressable>; })}</View></> : null}
          <Rule />{readiness.hint && !stamp.isPending ? <Text variant="footnote" color="textTertiary">{readiness.hint}</Text> : null}{stamp.error ? <InlineError message={errorText(stamp.error, stampSaved ? "The stamp was saved, but couldn't be added to those collections. Try again." : "Couldn't stamp that. Try again.")} onRetry={() => stamp.mutate()} retrying={stamp.isPending} /> : null}<EditorialButton label={stamp.isPending ? `Stamping…${photoUris.length ? ` ${Math.round(progress * 100)}%` : ""}` : "Stamp this place"} disabled={!readiness.ready} onPress={() => { Keyboard.dismiss(); haptics.select(); stamp.mutate(); }} />
        </>}
      </ScrollView>
      <PhotoViewer photos={photoUris.map((uri, index) => ({ id: `${uri}-${index}`, uri }))} index={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 24, gap: 14, paddingTop: 4 }, topbar: { minHeight: 50, alignItems: "flex-end", justifyContent: "center" }, topbarWithBack: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backTarget: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" }, cancelTarget: { minWidth: 64, height: 44, alignItems: "flex-end", justifyContent: "center" }, title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 64, lineHeight: 58, letterSpacing: -2 }, sectionTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 36, lineHeight: 39 }, modeRow: { flexDirection: "row", gap: 10 }, modeCard: { flex: 1, minHeight: 118, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textTertiary, padding: 14, gap: 8, justifyContent: "space-between" }, modeCardActive: { backgroundColor: colors.accent, borderColor: colors.accent }, modeTitle: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 15, letterSpacing: 1.5 }, modeTitleActive: { color: colors.onAccent }, dateBlock: { gap: 7 }, dateInput: { borderBottomWidth: 1, borderColor: colors.textPrimary, minHeight: 48, color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 20 }, searchInput: { minHeight: 50, borderBottomWidth: 1, borderColor: colors.textPrimary, color: colors.textPrimary, fontSize: 17 }, notice: { gap: 10, paddingVertical: 4 }, placeKicker: { color: colors.accent, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.7 }, verifiedNotice: { flexDirection: "row", alignItems: "center", gap: 8 }, photoStage: { height: 301, overflow: "hidden", backgroundColor: colors.elevated, position: "relative" }, photoPage: { height: 301, backgroundColor: colors.elevated }, emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }, photoCount: { position: "absolute", left: 12, bottom: 12, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 5 }, photoCountText: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 10 }, removePhoto: { position: "absolute", right: 10, top: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }, captionBlock: { gap: 4 }, captionInput: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 35, lineHeight: 39, minHeight: 86, paddingVertical: 5 }, counter: { color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 9, textAlign: "right" }, songWrap: { paddingVertical: 4 }, songAction: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, songLabel: { color: colors.textPrimary, fontSize: 16 }, hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, collectionBlock: { gap: 4 }, collectionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 }, collectionText: { flex: 1, gap: 2 },
});