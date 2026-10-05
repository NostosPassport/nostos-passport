import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { useMe, usePlaces, useUserPlaces } from "@/api/queries";
import { Body, DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { useUserCoords } from "@/features/location/location-store";
import { placesRegion } from "@/features/people/places";
import { formatDistance } from "@/lib/format";
import { HOME_REGION } from "@/lib/geo";
import { colors, selectedMarkerScale, size } from "@/theme";
import { type MapRegion, pinKind, sheetModel, statsByPlace, visiblePlaces } from "./map-model";
import { PinMarker } from "./PinMarker";
import { PlaceSheet } from "./PlaceSheet";

type Filter = "nearby" | "visited";

export function MapScreen() {
  const me = useMe();
  const places = usePlaces();
  const mine = useUserPlaces(me.data?.user.handle ?? "", !!me.data);
  const here = useUserCoords();
  const stats = useMemo(() => statsByPlace(mine.data?.places ?? []), [mine.data]);
  const start = useMemo(() => placesRegion(mine.data?.places ?? []) ?? HOME_REGION, [mine.data]);
  const [region, setRegion] = useState<MapRegion>(HOME_REGION);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("nearby");

  const all = useMemo(() => places.data?.places ?? [], [places.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((place) => {
      if (filter === "visited" && !stats.has(place.id)) return false;
      return !q || place.name.toLowerCase().includes(q) || place.neighborhood.toLowerCase().includes(q);
    });
  }, [all, filter, query, stats]);
  const drawn = useMemo(() => visiblePlaces(filtered, region, stats, selectedId), [filtered, region, stats, selectedId]);
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const model = selected ? sheetModel(selected, stats.get(selected.id), here, formatDistance) : null;

  return (
    <EditorialScreen>
      <EditorialSafeContent>
        <EditorialHeader compact action={<GearButton onPress={() => router.push("/settings")} />} />
        <Rule />
        <DisplayTitle size={52} style={styles.title}>Go somewhere.</DisplayTitle>
        <View style={styles.search}>
          <Icon name="magnifyingglass" color="textSecondary" size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a place"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Find a place"
          />
        </View>
        <View style={styles.filters}>
          <FilterButton label="NEARBY" active={filter === "nearby"} onPress={() => setFilter("nearby")} />
          <FilterButton label="VISITED" active={filter === "visited"} onPress={() => setFilter("visited")} />
        </View>
        <View style={styles.mapFrame}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={start}
            userInterfaceStyle="light"
            showsPointsOfInterests={false}
            showsCompass={false}
            pitchEnabled={false}
            onRegionChangeComplete={setRegion}
            onPress={() => setSelectedId(null)}
            accessibilityLabel="Map of your places"
          >
            {drawn.map((p) => {
              const kind = pinKind(p.id, stats);
              const isSelected = p.id === selectedId;
              return (
                <Marker
                  key={`${p.id}-${kind}-${isSelected}`}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  onPress={() => setSelectedId(p.id)}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  accessibilityLabel={`${p.name}, ${kind === "lit" ? "stamped" : "not stamped yet"}`}
                  zIndex={isSelected ? 3 : kind === "lit" ? 2 : 1}
                >
                  <PinMarker kind={kind} selected={isSelected} input={{ placeId: p.id, placeName: p.name, neighborhoodId: p.neighborhoodId, neighborhoodName: p.neighborhood }} />
                </Marker>
              );
            })}
            {here ? (
              <Marker coordinate={{ latitude: here.lat, longitude: here.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }} zIndex={4} accessibilityLabel="You are here" pointerEvents="none">
                <View style={styles.you} />
              </Marker>
            ) : null}
          </MapView>
          {places.data?.attribution ? (
            <View style={styles.attribution} pointerEvents="none">
              <Body muted size={10}>{places.data.attribution.text}</Body>
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

const YOU = size.marker / 2;
const styles = StyleSheet.create({
  title: { marginTop: 8, marginBottom: 8 },
  search: { height: 44, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  searchInput: { flex: 1, height: 44, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 },
  filters: { height: 48, flexDirection: "row", justifyContent: "space-between" },
  filter: { width: "47.5%", alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  mapFrame: { flex: 1, minHeight: 330, overflow: "hidden" },
  you: { width: YOU, height: YOU, borderRadius: YOU / 2, borderWidth: size.markerRing, borderColor: colors.background, backgroundColor: colors.accent, transform: [{ scale: selectedMarkerScale }] },
  attribution: { position: "absolute", left: 6, top: 6, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: colors.background, opacity: 0.85 },
});
