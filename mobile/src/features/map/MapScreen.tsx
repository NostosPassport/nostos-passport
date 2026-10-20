import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import type { Place } from "@/api/contracts";
import { useMe, usePlaces, useUserPlaces } from "@/api/queries";
import { Body, DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { useUserCoords } from "@/features/location/location-store";
import { placesRegion } from "@/features/people/places";
import { HOME_REGION } from "@/lib/geo";
import { localityKey, localityLabel } from "@/lib/place";
import { colors } from "@/theme";
import { mapRecenter } from "./recenter";
import { PinMarker } from "./PinMarker";

type MapFilter = "all" | "restaurant" | "bar";

const BAR_TYPES = new Set(["bar", "bar_and_grill", "beer_garden", "brewpub", "cocktail_bar", "gastropub", "hookah_bar", "irish_pub", "lounge_bar", "pub", "snack_bar", "sports_bar", "wine_bar"]);

function effectiveCategory(place: Place): Exclude<MapFilter, "all"> | null {
  if (place.category) return place.category;
  if (place.primaryType && BAR_TYPES.has(place.primaryType)) return "bar";
  if (place.primaryType === "restaurant" || place.primaryType?.endsWith("_restaurant") || place.primaryType === "steak_house") return "restaurant";
  if (place.cuisines.length > 0) return "restaurant";
  return null;
}

export function MapScreen() {
  const me = useMe();
  const storedPlaces = usePlaces();
  const mine = useUserPlaces(me.data?.user.handle ?? "", !!me.data);
  const here = useUserCoords();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(HOME_REGION);
  const centeredOnUserOnce = useRef(false);
  const fittedVisitedOnce = useRef(false);
  const [filter, setFilter] = useState<MapFilter>("all");
  const visited = useMemo(() => mine.data?.places ?? [], [mine.data?.places]);
  const categoryByPlace = useMemo(
    () => new Map((storedPlaces.data?.places ?? []).map((place) => [place.id, effectiveCategory(place)] as const)),
    [storedPlaces.data?.places],
  );
  const filteredVisited = useMemo(
    () => filter === "all" ? visited : visited.filter(({ place }) => categoryByPlace.get(place.id) === filter),
    [categoryByPlace, filter, visited],
  );
  const visitedRegion = useMemo(() => placesRegion(visited), [visited]);

  const recenter = useCallback(() => {
    if (!here) return;
    const current = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        latitude: here.lat,
        longitude: here.lng,
        latitudeDelta: current.latitudeDelta,
        longitudeDelta: current.longitudeDelta,
      },
      300,
    );
  }, [here]);

  const handleRecenter = useCallback(() => {
    if (!here) {
      router.push("/location-permission");
      return;
    }
    recenter();
  }, [here, recenter]);

  useEffect(() => mapRecenter.subscribe(recenter), [recenter]);
  useEffect(() => {
    if (!here || centeredOnUserOnce.current) return;
    centeredOnUserOnce.current = true;
    recenter();
  }, [here, recenter]);
  useEffect(() => {
    if (here || !visitedRegion || fittedVisitedOnce.current) return;
    fittedVisitedOnce.current = true;
    mapRef.current?.animateToRegion(visitedRegion, 300);
  }, [here, visitedRegion]);

  return (
    <EditorialScreen>
      <EditorialSafeContent bottom>
        <EditorialHeader compact action={<GearButton onPress={() => router.push("/settings")} />} />
        <Rule />
        <DisplayTitle size={52} style={styles.title}>Where you&apos;ve been.</DisplayTitle>
        <Body muted size={13}>Tap a place to open your most recent stamp there.</Body>
        <View style={styles.filters}>
          <FilterButton label="ALL" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterButton label="RESTAURANTS" active={filter === "restaurant"} onPress={() => setFilter("restaurant")} />
          <FilterButton label="BARS" active={filter === "bar"} onPress={() => setFilter("bar")} />
        </View>
        <View style={styles.mapFrame}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={visitedRegion ?? HOME_REGION}
            userInterfaceStyle="light"
            showsPointsOfInterests={false}
            showsCompass={false}
            showsUserLocation={!!here}
            showsMyLocationButton={false}
            pitchEnabled={false}
            onRegionChangeComplete={(next) => {
              regionRef.current = next;
            }}
            accessibilityLabel="Map of places you have stamped"
          >
            {filteredVisited.map(({ place, latestStamp }) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.lat, longitude: place.lng }}
                onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: latestStamp.id } })}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                accessibilityLabel={`${place.name}, open most recent stamp`}
              >
                <PinMarker
                  kind="lit"
                  selected={false}
                  input={{
                    placeId: place.id,
                    placeName: place.name,
                    localityKey: localityKey(place),
                    localityName: localityLabel(place),
                  }}
                />
              </Marker>
            ))}
          </MapView>
          <Pressable
            onPress={handleRecenter}
            accessibilityRole="button"
            accessibilityLabel={here ? "Recenter map on my location" : "Share location to recenter map"}
            style={({ pressed }) => [styles.recenter, pressed && styles.recenterPressed]}
          >
            <Icon name="location.fill" color="accent" size={20} />
          </Pressable>
        </View>
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.filter, active && styles.filterActive]}
    >
      <Kicker muted={!active}>{label}</Kicker>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 8, marginBottom: 4 },
  filters: { height: 48, flexDirection: "row", gap: 8, marginTop: 6 },
  filter: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  mapFrame: { flex: 1, minHeight: 300, overflow: "hidden", marginTop: 4, marginBottom: 4 },
  recenter: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  recenterPressed: { opacity: 0.75 },
});
