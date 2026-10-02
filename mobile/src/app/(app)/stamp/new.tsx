import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, View } from "react-native";

import { api, errorText } from "@/api";
import { CreateStampResponse, type NearbyPlacesResponse, type Song } from "@/api/contracts";
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
import { toast } from "@/components/ui/toast";
import { devSimulator } from "@/features/location/dev-simulator";
import { locationStore, usePermissionRefresh, useLocationState, useUserCoords } from "@/features/location/location-store";
import { SimulatedLocationChip } from "@/features/location/sim-chip";
import { CAMERA_NOTE, pickFromLibrary, takePhoto } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { autoPlace, CAPTION_MAX, orderPlaces, placeDistanceLabel, stampFields, stampProblem } from "@/features/stamps/composer";
import { songDraft } from "@/features/stamps/song-draft";
import { SongRow } from "@/features/stamps/song-row";
import { formatDistance } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, radius, size, space } from "@/theme";

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
  const queryClient = useQueryClient();
  const { permission } = useLocationState();
  const coords = useUserCoords();
  const nearby = useNearbyPlaces(coords);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const draft = { photoUri, caption, song };
  const dirty = !done && (photoUri !== null || caption.trim() !== "" || song !== null);
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
      if (photoUri) form.append("photo", { uri: photoUri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
      for (const [k, v] of stampFields(draft, here)) form.append(k, v);
      return api.upload(`/api/places/${encodeURIComponent(place.id)}/stamps`, CreateStampResponse, form, { onProgress: setProgress });
    },
    onSuccess: (res) => {
      haptics.success();
      setDone(true);
      toast.show("Stamped.");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      requestAnimationFrame(() => router.replace({ pathname: "/stamp/[id]", params: { id: res.stamp.id } }));
    },
    onError: () => haptics.warning(),
  });

  const problem = stampProblem(draft, place?.id ?? null);

  const addPhoto = () => {
    setPhotoNote(null);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Take photo", "Choose photo", "Cancel"], cancelButtonIndex: 2, tintColor: colors.accent, userInterfaceStyle: "dark" },
      (i) => {
        if (i === 2) return;
        void (async () => {
          const picked = i === 0 ? await takePhoto() : await pickFromLibrary();
          if (picked === null || picked === "cancelled") return;
          if (typeof picked === "string") return setPhotoNote(CAMERA_NOTE[picked]);
          setPreparing(true);
          try {
            setPhotoUri((await prepareImage(picked.uri)).uri);
          } catch {
            setPhotoNote("Couldn't use that photo. Try another one.");
          } finally {
            setPreparing(false);
          }
        })();
      },
    );
  };

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "New stamp",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Stamp" bold onPress={() => stamp.mutate()} disabled={!!problem || stamp.isPending || preparing} />,
        }}
      />

      <View style={styles.section}>
        <Text variant="footnote" color="textSecondary" style={styles.heading}>
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
          <ListGroup>
            {places.map((p) => (
              <ListRow
                key={p.id}
                icon={p.id === place?.id ? "checkmark.circle.fill" : "circle"}
                iconColor={p.id === place?.id ? "accent" : "textTertiary"}
                title={p.name}
                subtitle={`${p.neighborhood} · ${placeDistanceLabel(p, formatDistance)}`}
                accessibilityLabel={`${p.name}, ${placeDistanceLabel(p, formatDistance)}${p.id === place?.id ? ", selected" : ""}`}
                onPress={() => setChosenId(p.id)}
              />
            ))}
          </ListGroup>
        )}
        {__DEV__ && devSimulator && <DevPlaces />}
      </View>

      <View style={styles.section}>
        <Text variant="footnote" color="textSecondary" style={styles.heading}>
          PHOTO, CAPTION OR SONG
        </Text>
        {photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Your photo" />
            <Pressable onPress={() => setPhotoUri(null)} accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={space.xs} style={styles.removePhoto}>
              <Icon name="xmark" color="textPrimary" size={size.iconSmall} />
            </Pressable>
          </View>
        ) : (
          <Button title={preparing ? "Preparing photo…" : "Add a photo"} icon="camera.fill" variant="secondary" loading={preparing} onPress={addPhoto} />
        )}
        {photoNote && <InlineError message={photoNote} />}

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

      {problem && !stamp.isPending && (
        <Text variant="footnote" color="textTertiary" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
      {stamp.isPending && (
        <Text variant="footnote" color="textSecondary" accessibilityLiveRegion="polite">
          {photoUri ? `Stamping… ${Math.round(progress * 100)}%` : "Stamping…"}
        </Text>
      )}
      {/* The server's own sentence, e.g. "You need to be within 100 m of this place to stamp it (you're 140 m away)". */}
      {stamp.error && <InlineError message={errorText(stamp.error, "Couldn't stamp that. Try again.")} onRetry={() => stamp.mutate()} retrying={stamp.isPending} />}
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
  notice: { gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  photoWrap: { borderRadius: radius.card, overflow: "hidden" },
  photo: { width: "100%", height: size.postPhotoSkeleton, backgroundColor: colors.elevated },
  removePhoto: { position: "absolute", top: space.xs, right: space.xs, width: size.hitTarget, height: size.hitTarget, borderRadius: radius.pill, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  removeSong: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
