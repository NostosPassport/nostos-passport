import { useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActionSheetIOS, StyleSheet, useWindowDimensions, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import type { Place, UserPlacesResponse } from "@/api/contracts";
import { useMe, usePlaces, useUserPlaces } from "@/api/queries";
import { Body, DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { ScreenState } from "@/components/ui/screen-state";
import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { useUserCoords } from "@/features/location/location-store";
import { placesRegion } from "@/features/people/places";
import { useAnnounce } from "@/lib/a11y";
import { DEFAULT_REGION } from "@/lib/geo";
import { nav } from "@/lib/nav";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, dimmedOpacity, hairlineWidth, pressedOpacity, radius, shadows, size, space } from "@/theme";
import { HOTEL_TYPES, resolveCategoryStamp, type CategoryStampArtwork } from "../../../../shared/category-stamp-artwork";
import { groupPins, isSameSpot, userRegion, type PinGroup } from "./map-model";
import { PinMarker } from "./PinMarker";
import { mapRecenter } from "./recenter";

type MapFilter = "all" | "restaurant" | "bar" | "hotel";
type VisitedRow = UserPlacesResponse["places"][number];

const BAR_TYPES = new Set(["bar", "bar_and_grill", "beer_garden", "brewpub", "cocktail_bar", "gastropub", "hookah_bar", "irish_pub", "lounge_bar", "pub", "snack_bar", "sports_bar", "wine_bar","night_club","nightclub","dance_club"]);

const EMPTY_FILTER_COPY: Record<Exclude<MapFilter, "all">, string> = {
  restaurant: "No restaurants stamped yet.",
  bar: "No bars stamped yet.",
  hotel: "No hotels stamped yet.",
};

/** How long a marker keeps tracking view changes after its artwork resolves, so the native snapshot is current. */
const MARKER_SETTLE_MS = 500;
/** The smallest span used when zooming into a group, so pins a few metres apart separate (P-052). */
const GROUP_MIN_DELTA = 0.002;

function effectiveCategory(place: Place): Exclude<MapFilter, "all"> | null {
  if (place.category) return place.category;
  if (place.primaryType && BAR_TYPES.has(place.primaryType)) return "bar";
  if (place.primaryType === "restaurant" || place.primaryType?.endsWith("_restaurant") || place.primaryType === "steak_house") return "restaurant";
  if (place.primaryType && HOTEL_TYPES.has(place.primaryType)) return "hotel";
  if (place.cuisines.length > 0) return "restaurant";
  return null;
}

const openStamp = (row: VisitedRow) => nav.push({ pathname: "/stamp/[id]", params: { id: row.latestStamp.id } });

export function MapScreen() {
  // iPhone SE-class heights: a smaller display title so the map keeps most of the screen (P-044).
  const compact = useWindowDimensions().height < 740;
  const navigation = useNavigation();
  const me = useMe();
  const storedPlaces = usePlaces();
  const mine = useUserPlaces(me.data?.user.handle ?? "", !!me.data);
  const here = useUserCoords();
  const mapRef = useRef<MapView>(null);
  const centeredOnUser = useRef(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const loading = me.isPending || (!!me.data && mine.isPending);
  const failed = !loading && (me.isError || mine.isError);
  const visited = useMemo(() => mine.data?.places ?? [], [mine.data?.places]);
  const categoriesReady = !!storedPlaces.data;
  const visitedRegion = useMemo(() => placesRegion(visited), [visited]);

  // One camera decision, made once the visited places have settled: the visited region if there is one, otherwise
  // the user, otherwise a neutral wide view (P-054, P-058). The only later automatic move is from that neutral view
  // to the user, if their location arrives after the map has opened.
  const [initial, setInitial] = useState<{ region: Region; settled: boolean } | null>(null);
  if (!loading && initial === null) {
    setInitial({ region: visitedRegion ?? (here ? userRegion(here, null) : DEFAULT_REGION), settled: !!visitedRegion || !!here });
  }

  // A filter choice lasts until a new stamp arrives; then the map goes back to ALL so the new pin is visible (P-053).
  const totalStamps = visited.reduce((sum, row) => sum + row.stamps, 0);
  const [choice, setChoice] = useState<{ filter: MapFilter; atTotal: number }>({ filter: "all", atTotal: 0 });
  const filter: MapFilter = totalStamps > choice.atTotal ? "all" : choice.filter;

  const categoryByPlace = useMemo(
    () => new Map((storedPlaces.data?.places ?? []).map((place) => [place.id, effectiveCategory(place)] as const)),
    [storedPlaces.data?.places],
  );
  const artworkByPlace = useMemo(() => new Map((storedPlaces.data?.places ?? []).map(place => [place.id, resolveCategoryStamp(place)] as const)), [storedPlaces.data?.places]);
  const rowsFor = useCallback(
    (value: MapFilter) => value === "all" ? visited : visited.filter(({ place }) => categoryByPlace.get(place.id) === value),
    [categoryByPlace, visited],
  );
  const filteredVisited = useMemo(() => rowsFor(filter), [filter, rowsFor]);
  const groups = useMemo(
    () => groupPins(filteredVisited, region ?? initial?.region ?? DEFAULT_REGION, frame, size.marker),
    [filteredVisited, region, initial, frame],
  );

  const recenter = useCallback(() => {
    if (!here) return;
    mapRef.current?.animateToRegion(userRegion(here, region), 300);
  }, [here, region]);

  const handleRecenter = useCallback(() => {
    if (!here) {
      nav.push("/location-permission");
      return;
    }
    recenter();
  }, [here, recenter]);

  const chooseFilter = (value: MapFilter) => {
    setChoice({ filter: value, atTotal: totalStamps });
    // Refit to what the filter shows, so matches off-screen come into view (P-046).
    const fit = placesRegion(rowsFor(value));
    if (fit) mapRef.current?.animateToRegion(fit, 300);
  };

  const openGroup = (group: PinGroup) => {
    const [first] = group.members;
    if (!first) return;
    if (group.members.length === 1) return openStamp(first);
    if (isSameSpot(group.members)) {
      const names = group.members.map((m) => m.place.name);
      ActionSheetIOS.showActionSheetWithOptions({ title: "Stamped here", options: [...names, "Cancel"], cancelButtonIndex: names.length }, (index) => {
        const row = group.members[index];
        if (row) openStamp(row);
      });
      return;
    }
    const fit = placesRegion(group.members);
    if (!fit) return;
    mapRef.current?.animateToRegion({ ...fit, latitudeDelta: Math.max(GROUP_MIN_DELTA, fit.latitudeDelta * 0.6), longitudeDelta: Math.max(GROUP_MIN_DELTA, fit.longitudeDelta * 0.6) }, 300);
  };

  // A Map tab press re-centres only when the map is already showing, the usual "tap again" pattern. Switching to the
  // map from another tab keeps where you left it (P-050).
  useEffect(() => mapRecenter.subscribe(() => {
    if (navigation.isFocused()) recenter();
  }), [navigation, recenter]);
  useEffect(() => {
    if (!initial || initial.settled || !here || centeredOnUser.current) return;
    centeredOnUser.current = true;
    recenter();
  }, [initial, here, recenter]);

  const emptyFilterCopy = !loading && !failed && categoriesReady && visited.length > 0 && filter !== "all" && filteredVisited.length === 0 ? EMPTY_FILTER_COPY[filter] : null;
  useAnnounce(emptyFilterCopy);
  const filtersDisabled = loading || failed || !categoriesReady;

  return (
    <EditorialScreen>
      <EditorialSafeContent>
        <EditorialHeader compact action={<GearButton onPress={() => nav.push("/settings")} />} />
        <Rule />
        <DisplayTitle size={compact ? 38 : 52} style={styles.title}>Where you&apos;ve been.</DisplayTitle>
        <Body muted size={13}>Tap a place to open your most recent stamp there.</Body>
        <View style={styles.filters}>
          <FilterButton label="ALL" active={filter === "all"} disabled={filtersDisabled} onPress={() => chooseFilter("all")} />
          <FilterButton label="RESTAURANTS" active={filter === "restaurant"} disabled={filtersDisabled} onPress={() => chooseFilter("restaurant")} />
          <FilterButton label="BARS" active={filter === "bar"} disabled={filtersDisabled} onPress={() => chooseFilter("bar")} />
          <FilterButton label="HOTELS" active={filter === "hotel"} disabled={filtersDisabled} onPress={() => chooseFilter("hotel")} />
        </View>
        <View style={styles.mapFrame} onLayout={(e) => setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          {initial ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={initial.region}
              userInterfaceStyle="light"
              showsPointsOfInterests={false}
              showsCompass={false}
              showsUserLocation={!!here}
              showsMyLocationButton={false}
              pitchEnabled={false}
              onRegionChangeComplete={setRegion}
              accessibilityLabel="Map of places you have stamped"
            >
              {groups.map((group) => (
                <MapPin key={group.key} group={group} artwork={group.members[0] ? artworkByPlace.get(group.members[0].place.id) : undefined} onPress={() => openGroup(group)} />
              ))}
            </MapView>
          ) : null}
          {loading ? (
            <Overlay><ScreenState kind="loading" label="Loading your places" /></Overlay>
          ) : failed ? (
            <Overlay>
              <ScreenState kind="error" message="Couldn't load your places." retrying={me.isFetching || mine.isFetching} onRetry={() => { if (me.isError) void me.refetch(); else void mine.refetch(); }} />
            </Overlay>
          ) : visited.length === 0 ? (
            <Overlay>
              <ScreenState kind="empty" icon="mappin.and.ellipse" title="Places you stamp appear here" message="Stamp a restaurant, bar or hotel and it gets a pin on this map." action={{ label: "Stamp a place", onPress: () => nav.push("/stamp/new") }} />
            </Overlay>
          ) : null}
          {emptyFilterCopy ? (
            <View style={styles.note} pointerEvents="none">
              <Text variant="footnote" align="center">{emptyFilterCopy}</Text>
            </View>
          ) : null}
          <Tappable
            onPress={handleRecenter}
            accessibilityRole="button"
            accessibilityLabel={here ? "Recenter map on my location" : "Share location to recenter map"}
            style={({ pressed }) => [styles.recenter, pressed && styles.recenterPressed]}
          >
            <Icon name="location.fill" color="accent" size={size.icon} />
          </Tappable>
        </View>
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

/** A small card over the map for loading, error and empty states (P-045). The map stays visible around it. */
function Overlay({ children }: { children: ReactNode }) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * One pin, or a group of pins with a count. The key is stable (place ids only), so pins don't remount when artwork
 * loads. `tracksViewChanges` stays on only until the artwork has settled (P-051); on iOS Apple Maps the prop is
 * ignored and the stable key is what stops the flicker.
 */
function MapPin({ group, artwork, onPress }: { group: PinGroup; artwork: CategoryStampArtwork | null | undefined; onPress: () => void }) {
  const artworkKey = artwork?.icon ?? "legacy";
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const tracking = settledKey !== artworkKey;
  useEffect(() => {
    if (!tracking) return;
    const timer = setTimeout(() => setSettledKey(artworkKey), MARKER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [tracking, artworkKey]);

  const [first] = group.members;
  if (!first) return null;
  const count = group.members.length;
  const label = count === 1
    ? `${first.place.name}, open most recent stamp`
    : `${count} places: ${group.members.map((m) => m.place.name).join(", ")}. ${isSameSpot(group.members) ? "Choose one" : "Zoom in"}`;
  return (
    <Marker
      coordinate={{ latitude: group.latitude, longitude: group.longitude }}
      onPress={onPress}
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: 0.5 }}
      accessibilityLabel={label}
    >
      <View style={styles.pin}>
        <PinMarker
          artwork={artwork}
          kind="lit"
          selected={false}
          input={{ placeId: first.place.id, placeName: first.place.name, localityKey: localityKey(first.place), localityName: localityLabel(first.place) }}
        />
        {count > 1 ? (
          <View style={styles.badge}>
            {/* Marker snapshots don't reflow, so the count stays at its base size inside the fixed badge. */}
            <Text variant="caption" color="onAccent" weight="semibold" tabular maxFontSizeMultiplier={1}>{count}</Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

function FilterButton({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      style={[styles.filter, active && styles.filterActive, disabled && styles.filterDisabled]}
    >
      <Kicker muted={!active}>{label}</Kicker>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.xs, marginBottom: space.xxs },
  filters: { minHeight: 48, flexDirection: "row", gap: space.xs, marginTop: space.xxs },
  // Content-sized cells: "RESTAURANTS" does not fit a quarter of an iPhone SE, so equal widths would wrap it.
  filter: { flexGrow: 1, flexShrink: 0, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  filterDisabled: { opacity: dimmedOpacity },
  // A hairline frame so the map reads as a plate set on the page, not a raw tile bleeding into the paper.
  mapFrame: { flex: 1, minHeight: 200, overflow: "hidden", marginTop: space.xxs, marginBottom: space.sm, backgroundColor: colors.paperDeep, borderWidth: hairlineWidth, borderColor: colors.hairline },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: space.lg },
  card: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: hairlineWidth, borderColor: colors.hairline, ...shadows.soft },
  note: {
    position: "absolute",
    top: space.sm,
    alignSelf: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    ...shadows.contact,
  },
  pin: { padding: space.xxs },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: size.markerBadge,
    height: size.markerBadge,
    paddingHorizontal: space.xxs,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: hairlineWidth,
    borderColor: colors.surface,
  },
  recenter: {
    position: "absolute",
    right: space.sm,
    bottom: space.sm,
    width: size.hitTarget,
    height: size.hitTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    ...shadows.soft,
  },
  recenterPressed: { opacity: pressedOpacity },
});
