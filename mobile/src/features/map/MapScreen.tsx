import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text as NativeText, TextInput, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { useMe, useNearbyPlaces, usePlaces, usePlaceSearch, useUserPlaces } from "@/api/queries";
import { Body, DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { useUserCoords } from "@/features/location/location-store";
import { placesRegion } from "@/features/people/places";
import { formatDistance } from "@/lib/format";
import { distanceMeters, HOME_REGION } from "@/lib/geo";
import { colors, fonts, size } from "@/theme";
import { type MapRegion, pinKind, sheetModel, statsByPlace, visiblePlaces } from "./map-model";
import { mapRecenter } from "./recenter";
import { PinMarker } from "./PinMarker";
import { PlaceSheet } from "./PlaceSheet";

type Filter = "nearby" | "visited";

const mapRadius = (region: MapRegion) => Math.max(500, Math.min(5_000, Math.round(Math.max(region.latitudeDelta, region.longitudeDelta) * 111_195 * 0.7)));
const mapProvider = Constants.appOwnership === "expo" ? undefined : PROVIDER_GOOGLE;

function regionNeedsSearch(region: MapRegion, searched: MapRegion | null) {
  if (!searched) return true;
  const moved = distanceMeters(
    { lat: region.latitude, lng: region.longitude },
    { lat: searched.latitude, lng: searched.longitude },
  );
  const searchedRadius = mapRadius(searched);
  const currentRadius = mapRadius(region);
  const movedEnough = moved >= Math.max(150, Math.min(1_000, searchedRadius * 0.35));
  const zoomChangedEnough = currentRadius / searchedRadius >= 1.35 || currentRadius / searchedRadius <= 0.75;
  return movedEnough || zoomChangedEnough;
}

export function MapScreen() {
  const me = useMe();
  const storedPlaces = usePlaces();
  const mine = useUserPlaces(me.data?.user.handle ?? "", !!me.data);
  const here = useUserCoords();
  const stats = useMemo(() => statsByPlace(mine.data?.places ?? []), [mine.data]);
  const start = useMemo(() => placesRegion(mine.data?.places ?? []) ?? HOME_REGION, [mine.data]);
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<TextInput>(null);
  const regionRef = useRef<MapRegion>(HOME_REGION);
  const centeredOnce = useRef(false);
  const autoSearchNextRegion = useRef(false);
  const [region, setRegion] = useState<MapRegion>(HOME_REGION);
  const [searchedRegion, setSearchedRegion] = useState<MapRegion | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("nearby");
  const centre = useMemo(() => ({ lat: region.latitude, lng: region.longitude }), [region.latitude, region.longitude]);
  const searchedCentre = useMemo(
    () => searchedRegion ? { lat: searchedRegion.latitude, lng: searchedRegion.longitude } : null,
    [searchedRegion],
  );
  const nearby = useNearbyPlaces(searchedCentre, searchedRegion ? mapRadius(searchedRegion) : 750);
  const search = usePlaceSearch(query, centre);

  const dismissSearch = useCallback(() => {
    searchRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const recenter = useCallback(() => {
    if (!here) return;
    const current = regionRef.current;
    autoSearchNextRegion.current = true;
    mapRef.current?.animateToRegion(
      { latitude: here.lat, longitude: here.lng, latitudeDelta: current.latitudeDelta, longitudeDelta: current.longitudeDelta },
      300,
    );
  }, [here]);

  useEffect(() => mapRecenter.subscribe(recenter), [recenter]);
  useEffect(() => {
    if (!here || centeredOnce.current) return;
    centeredOnce.current = true;
    recenter();
  }, [here, recenter]);

  const searching = query.trim().length >= 2;
  const all = useMemo(() => {
    if (filter === "visited") {
      const q = query.trim().toLowerCase();
      return (storedPlaces.data?.places ?? []).filter((place) => stats.has(place.id) && (!q || place.name.toLowerCase().includes(q) || place.neighborhood.toLowerCase().includes(q) || place.cuisines.some((cuisine) => cuisine.toLowerCase().includes(q))));
    }
    if (searching) return search.data?.places ?? [];
    return nearby.data?.places ?? [];
  }, [filter, nearby.data?.places, query, search.data?.places, searching, stats, storedPlaces.data?.places]);
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const effectiveSelectedId = selected?.id ?? null;
  const drawn = visiblePlaces(all, region, stats, effectiveSelectedId);
  const model = selected ? sheetModel(selected, stats.get(selected.id), here, formatDistance) : null;
  const showSearchArea = filter === "nearby" && !searching && regionNeedsSearch(region, searchedRegion);

  const searchThisArea = useCallback(() => {
    dismissSearch();
    setSelectedId(null);
    setSearchedRegion(regionRef.current);
  }, [dismissSearch]);

  return (
    <EditorialScreen>
      <EditorialSafeContent bottom>
        <EditorialHeader compact action={<GearButton onPress={() => router.push("/settings")} />} />
        <Rule />
        <Pressable onPress={dismissSearch} accessible={false}>
          <DisplayTitle size={52} style={styles.title}>Go somewhere.</DisplayTitle>
        </Pressable>
        <View style={styles.search}>
          <Icon name="magnifyingglass" color="textSecondary" size={18} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={dismissSearch}
            placeholder={filter === "visited" ? "Search visited places" : "Find a restaurant or bar"}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={filter === "visited" ? "Search visited places" : "Find a restaurant or bar"}
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              style={styles.clearSearch}
            >
              <Icon name="xmark" color="textSecondary" size={15} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filters}>
          <FilterButton label="NEARBY" active={filter === "nearby"} onPress={() => { dismissSearch(); setFilter("nearby"); setSelectedId(null); }} />
          <FilterButton label="VISITED" active={filter === "visited"} onPress={() => { dismissSearch(); setFilter("visited"); setSelectedId(null); }} />
        </View>
        <View style={styles.mapFrame}>
          <MapView
            ref={mapRef}
            provider={mapProvider}
            style={StyleSheet.absoluteFill}
            initialRegion={start}
            userInterfaceStyle="light"
            showsPointsOfInterests={false}
            showsCompass={false}
            showsUserLocation={!!here}
            showsMyLocationButton={false}
            pitchEnabled={false}
            onRegionChangeComplete={(next) => {
              regionRef.current = next;
              setRegion(next);
              if (autoSearchNextRegion.current) {
                autoSearchNextRegion.current = false;
                setSearchedRegion(next);
              }
            }}
            onPress={() => {
              dismissSearch();
              setSelectedId(null);
            }}
            accessibilityLabel="Map of restaurants, bars and your stamped places"
          >
            {drawn.map((p) => {
              const kind = pinKind(p.id, stats);
              const isSelected = p.id === effectiveSelectedId;
              return (
                <Marker
                  key={`${p.id}-${kind}-${isSelected}`}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  onPress={() => {
                    dismissSearch();
                    setSelectedId(p.id);
                  }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  accessibilityLabel={`${p.name}, ${kind === "lit" ? "stamped" : "not stamped yet"}`}
                  zIndex={isSelected ? 3 : kind === "lit" ? 2 : 1}
                >
                  <PinMarker kind={kind} selected={isSelected} input={{ placeId: p.id, placeName: p.name, neighborhoodId: p.neighborhoodId, neighborhoodName: p.neighborhood }} />
                </Marker>
              );
            })}
          </MapView>
          {showSearchArea ? (
            <Pressable style={styles.searchArea} onPress={searchThisArea} accessibilityRole="button" accessibilityLabel="Search restaurants and bars in this map area">
              <Icon name="magnifyingglass" color="onAccent" size={15} />
              <NativeText style={styles.searchAreaText}>Search this area</NativeText>
            </Pressable>
          ) : null}
          {filter === "visited" && storedPlaces.data?.attribution ? (
            <View style={styles.attribution} pointerEvents="none">
              <Body muted size={10}>{storedPlaces.data.attribution.text}</Body>
            </View>
          ) : null}
        </View>
      </EditorialSafeContent>
      <PlaceSheet
        model={model}
        onClose={() => setSelectedId(null)}
        onStamp={() => {
          setSelectedId(null);
          router.push("/stamp/new");
        }}
        onOpenPlace={selected ? () => router.push({ pathname: "/place/[id]", params: { id: selected.id } }) : undefined}
      />
    </EditorialScreen>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Kicker>{label}</Kicker>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 8, marginBottom: 8 },
  search: { height: 44, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  searchInput: { flex: 1, height: 44, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 },
  clearSearch: { width: size.hitTarget, height: 44, alignItems: "center", justifyContent: "center" },
  filters: { height: 48, flexDirection: "row", justifyContent: "space-between" },
  filter: { width: "47.5%", alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  mapFrame: { flex: 1, minHeight: 300, overflow: "hidden", marginBottom: 4 },
  searchArea: { position: "absolute", alignSelf: "center", top: 12, minHeight: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.accent },
  searchAreaText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  attribution: { position: "absolute", left: 6, top: 6, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: colors.background, opacity: 0.85 },
});
