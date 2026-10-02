import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { api, errorText } from "@/api";
import { CreateStampResponse, type NearbyPlacesResponse, type Song } from "@/api/contracts";
import { qk } from "@/api/keys";
import { useNearbyPlaces, usePlaces } from "@/api/queries";
import { AccountGate } from "@/features/account/account-gate";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { devSimulator } from "@/features/location/dev-simulator";
import { locationStore, usePermissionRefresh, useLocationState, useUserCoords } from "@/features/location/location-store";
import { SimulatedLocationChip } from "@/features/location/sim-chip";
import { autoPlace, CAPTION_MAX, orderPlaces, stampFields, stampProblem } from "@/features/stamps/composer";
import { landingDraft } from "@/features/stamps/landing-draft";
import { photoDraft, usePhotoDraft } from "@/features/stamps/photo-draft";
import { songDraft } from "@/features/stamps/song-draft";
import { HONESTY, MAX_STAMP_PHOTOS, photoCount, placeRowText, placeSections, stampReadiness } from "@/features/stamps/stamp-flow";
import { SongRow } from "@/features/stamps/song-row";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

type Nearby = NearbyPlacesResponse["places"][number];

/**
 * The stamp composer. Pick the place you're at (the list comes from where your phone is; the server checks the
 * geofence again), add a photo, a caption, a song, any mix, then Stamp. If you're outside the geofence the server's
 * message, with how far away you are, is shown as it is.
 */
export default function NewStamp() {
  return (
    <AccountGate title="Stamp a place" message="Sign in to stamp the places you go.">
      <Composer />
    </AccountGate>
  );
}

function Composer() {
  usePermissionRefresh();
  // Leaving the composer any way at all drops the photos taken for it.
  useEffect(() => () => photoDraft.clear(), []);
  const queryClient = useQueryClient();
  const { permission } = useLocationState();
  const coords = useUserCoords();
  const nearby = useNearbyPlaces(coords);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const photoUris = usePhotoDraft();
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const draft = { photoUris, caption, song };
  const dirty = !done && (photoUris.length > 0 || caption.trim() !== "" || song !== null);
  useConfirmDiscard(dirty);

  const places = orderPlaces(nearby.data?.places ?? []);
  // The place you picked, or (when exactly one geofence has you inside) that one without asking.
  const place: Nearby | null = places.find((p) => p.id === chosenId) ?? autoPlace(places);

  // A song picked on the song screen comes back here when this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      const picked = songDraft.take();
      if (picked) setSong(picked.song);
    }, []),
  );

  const stamp = useMutation({
    mutationFn: async () => {
      if (!place) throw new Error("no place");
      // A fresh fix right now: the server checks these coordinates, not the ones the place list was built from.
      const here = (await locationStore.currentForPosting()) ?? coords;
      if (!here) throw new Error("no location");
      const form = new FormData();
      // React Native's FormData takes a file descriptor object for local files.
      for (const [i, uri] of photoUris.entries()) form.append("photos", { uri, name: `photo-${i + 1}.jpg`, type: "image/jpeg" } as unknown as Blob);
      for (const [k, v] of stampFields(draft, here)) form.append(k, v);
      return api.upload(`/api/places/${encodeURIComponent(place.id)}/stamps`, CreateStampResponse, form, { onProgress: setProgress });
    },
    onSuccess: (res) => {
      setDone(true);
      photoDraft.clear();
      landingDraft.set(res.stamp, res.progress);
      for (const key of [["feed"], ["user"], qk.neighborhoods, qk.pins]) void queryClient.invalidateQueries({ queryKey: key });
      // The landing says "Stamped" itself, with the haptic knock at the moment of impact.
      requestAnimationFrame(() => router.replace("/stamp/landed"));
    },
    onError: () => haptics.warning(),
  });

  const problem = stampProblem(draft, place?.id ?? null);

  const readiness = stampReadiness({ place, problem, busy: stamp.isPending });
  const sections = placeSections(places);

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "New stamp",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => { photoDraft.clear(); router.back(); }} />,
        }}
      />

      <View style={styles.honesty} accessible accessibilityLabel={`${HONESTY.title}. ${HONESTY.body}`}>
        <Icon name="location.fill" color="dimBrass" size={size.iconSmall} />
        <View style={styles.honestyText}>
          <Text variant="serifLabel" color="brass">
            {HONESTY.title}
          </Text>
          <Text variant="typewriterSmall" color="textSecondary">
            {HONESTY.body}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="serifLabel" color="dimBrass" style={styles.heading} accessibilityRole="header">
          WHERE ARE YOU?
        </Text>
        <SimulatedLocationChip />
        {permission !== "granted" && !coords ? (
          <View style={styles.notice}>
            <Icon name="location.fill" color="accent" size={size.iconLarge} />
            <Text variant="callout" color="textSecondary">
              {permission === "denied" ? "Location is off. Turn it on in Settings to stamp the places you're at." : "Nostos checks that you're at a place before it gives you a stamp."}
            </Text>
            <Button title={permission === "denied" ? "Open settings" : "Use my location"} variant="secondary" block={false} onPress={() => router.push("/location-permission")} />
          </View>
        ) : nearby.isPending || !coords ? (
          <SkeletonRows count={2} />
        ) : nearby.isError ? (
          <InlineError message={errorText(nearby.error, "Couldn't find places near you.")} onRetry={() => void nearby.refetch()} retrying={nearby.isFetching} />
        ) : places.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            No places near you yet. Nostos stamps places in New York.
          </Text>
        ) : (
          sections.map((group) => (
            <ListGroup key={group.title} header={group.title}>
              {group.places.map((p) => {
                const row = placeRowText(p);
                const selected = p.id === place?.id;
                return (
                  <ListRow
                    key={p.id}
                    icon={selected ? "checkmark.circle.fill" : "circle"}
                    iconColor={selected ? "accent" : "textTertiary"}
                    title={row.title}
                    subtitle={row.subtitle}
                    accessibilityLabel={`${row.spoken}${selected ? ", selected" : ""}`}
                    onPress={() => setChosenId(p.id)}
                  />
                );
              })}
            </ListGroup>
          ))
        )}
        {__DEV__ && devSimulator && <DevPlaces />}
      </View>

      <View style={styles.section}>
        <Text variant="serifLabel" color="dimBrass" style={styles.heading} accessibilityRole="header">
          PHOTOS, CAPTION OR SONG
        </Text>
        <View style={styles.photos}>
          {photoUris.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.thumb}>
              <Image source={{ uri }} style={styles.fill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
              <Pressable onPress={() => photoDraft.remove(i)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={space.xs} style={styles.removePhoto}>
                <Icon name="xmark" color="textPrimary" size={size.iconTiny} />
              </Pressable>
            </View>
          ))}
        </View>
        {photoUris.length < MAX_STAMP_PHOTOS ? (
          <Button title={photoUris.length === 0 ? "Take a photo" : `Take another photo (${photoCount(photoUris.length)})`} icon="camera.fill" variant="secondary" onPress={() => router.push("/stamp/camera")} />
        ) : (
          <Text variant="footnote" color="textTertiary">
            Six photos is the most a stamp holds.
          </Text>
        )}

        <FieldGroup footer={`${caption.length}/${CAPTION_MAX}`}>
          <Field label="Caption" value={caption} onChangeText={setCaption} maxLength={CAPTION_MAX} placeholder="What's it like?" multiline accessibilityHint={`Up to ${CAPTION_MAX} characters`} />
        </FieldGroup>

        {song ? (
          <SongRow
            song={song}
            trailing={
              <Pressable onPress={() => setSong(null)} accessibilityRole="button" accessibilityLabel="Remove song" hitSlop={space.xs} style={styles.removeSong}>
                <Icon name="xmark.circle.fill" color="textTertiary" size={size.icon} />
              </Pressable>
            }
          />
        ) : (
          <Button title="Add a song" icon="music.note" variant="secondary" onPress={() => router.push("/stamp/song")} />
        )}
      </View>

      {readiness.calm ? (
        <View style={styles.calm} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${readiness.calm.title}. ${readiness.calm.body}`}>
          <Icon name="figure.walk" color="dimBrass" size={size.iconLarge} />
          <View style={styles.honestyText}>
            <Text variant="title2" color="brass">
              {readiness.calm.title}
            </Text>
            <Text variant="typewriter" color="textSecondary">
              {readiness.calm.body}
            </Text>
          </View>
        </View>
      ) : null}
      {readiness.hint && !stamp.isPending ? (
        <Text variant="footnote" color="textTertiary" accessibilityLiveRegion="polite">
          {readiness.hint}
        </Text>
      ) : null}
      {stamp.isPending ? (
        <Text variant="footnote" color="textSecondary" accessibilityLiveRegion="polite">
          {photoUris.length > 0 ? `Stamping… ${Math.round(progress * 100)}%` : "Stamping…"}
        </Text>
      ) : null}
      {/* The server's own sentence, e.g. "You need to be within 100 m of this place to stamp it (you're 140 m away)". */}
      {stamp.error && <InlineError message={errorText(stamp.error, "Couldn't stamp that. Try again.")} onRetry={() => stamp.mutate()} retrying={stamp.isPending} />}

      <Button title="Stamp" icon="seal.fill" loading={stamp.isPending} disabled={!readiness.ready} onPress={() => stamp.mutate()} accessibilityHint={readiness.ready ? "Stamps this place" : undefined} />
    </FormScreen>
  );
}

/** Development only: pretend to be at a place, to try the geofence without going there. */
function DevPlaces() {
  const places = usePlaces();
  if (!devSimulator) return null;
  const list = (places.data?.places ?? []).slice(0, 6);
  return (
    <ListGroup header="Development: pretend to be at">
      {list.map((p) => (
        <ListRow key={p.id} icon="location.slash" title={p.name} subtitle={p.neighborhood} onPress={() => devSimulator?.set({ lat: p.lat, lng: p.lng })} />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { paddingHorizontal: space.md },
  honesty: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: hairlineWidth, borderColor: colors.hairline },
  honestyText: { flex: 1, gap: space.xxs },
  notice: { gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  thumb: { width: size.avatarLarge + space.md, height: size.avatarLarge + space.md, borderRadius: radius.chip, overflow: "hidden", backgroundColor: colors.elevated },
  fill: { width: "100%", height: "100%" },
  removePhoto: { position: "absolute", top: space.xxs, right: space.xxs, width: size.iconSmall + space.xs, height: size.iconSmall + space.xs, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  removeSong: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  calm: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: hairlineWidth, borderColor: colors.dimBrass },
});
