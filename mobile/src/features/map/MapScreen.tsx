import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { useMe, usePlaces, useUserPlaces } from "@/api/queries";
import { Text } from "@/components/ui/text";
import { placesRegion } from "@/features/people/places";
import { useUserCoords } from "@/features/location/location-store";
import { formatDistance } from "@/lib/format";
import { HOME_REGION } from "@/lib/geo";
import { colors, radius, selectedMarkerScale, size, space } from "@/theme";
import { type MapRegion, pinKind, sheetModel, statsByPlace, visiblePlaces } from "./map-model";
import { PinMarker } from "./PinMarker";
import { PlaceSheet } from "./PlaceSheet";

/**
 * The map: dark, with the places you have stamped glowing brass as little stamps and the rest as dim dots. Tap a pin for its sheet.
 * Your own position is a small bone ring (not the system's blue dot: nothing here is another color).
 */
export function MapScreen() {
  const me = useMe();
  const places = usePlaces();
  const mine = useUserPlaces(me.data?.user.handle ?? "", !!me.data);
  const here = useUserCoords();
  const stats = useMemo(() => statsByPlace(mine.data?.places ?? []), [mine.data]);
  const start = useMemo(() => placesRegion(mine.data?.places ?? []) ?? HOME_REGION, [mine.data]);
  const [region, setRegion] = useState<MapRegion>(HOME_REGION);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = useMemo(() => places.data?.places ?? [], [places.data]);
  const drawn = useMemo(() => visiblePlaces(all, region, stats, selectedId), [all, region, stats, selectedId]);
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const model = selected ? sheetModel(selected, stats.get(selected.id), here, formatDistance) : null;

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={start}
        userInterfaceStyle="dark"
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
          <Text variant="caption" color="boneDim">
            {places.data.attribution.text}
          </Text>
        </View>
      ) : null}
      <PlaceSheet
        model={model}
        onClose={() => setSelectedId(null)}
        onStamp={() => {
          setSelectedId(null);
          router.push("/stamp/new");
        }}
      />
    </View>
  );
}

const YOU = size.marker / 2;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  you: { width: YOU, height: YOU, borderRadius: YOU / 2, borderWidth: size.markerRing, borderColor: colors.bone, backgroundColor: colors.background, transform: [{ scale: selectedMarkerScale }] },
  attribution: { position: "absolute", left: space.sm, top: space.xxxl + space.md, paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.chip, backgroundColor: colors.scrim },
});
