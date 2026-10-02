import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import type { MapVenue } from "@/api/contracts";
import { useMe, useVenues } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Text } from "@/components/ui/text";
import { simulateAtPress } from "@/features/location/dev-simulator";
import { usePermissionRefresh, useLocationState, useSortCoords } from "@/features/location/location-store";
import { HomeSheet, type HomeSheetHandle } from "@/features/map/home-sheet";
import { SimulatedLocationChip } from "@/features/map/sim-chip";
import { TopBar } from "@/features/map/top-bar";
import { useFriendsByVenue } from "@/features/map/use-friends-by-venue";
import { VenueMarker } from "@/features/map/venue-marker";
import { haptics } from "@/lib/haptics";
import { HOME_REGION } from "@/lib/geo";
import { openExternal } from "@/lib/links";
import { colors, maxDurationMs, radius, screenPadding, size, space } from "@/theme";

/** Below this latitude span (about 4 blocks tall) busy markers carry their name and vibe word. */
const LABEL_DELTA = 0.004;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { status } = useAuth();
  const guest = status !== "signedIn";
  const me = useMe();
  const venues = useVenues();
  const location = useLocationState();
  const sortCoords = useSortCoords();
  const friendsByVenue = useFriendsByVenue();
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<HomeSheetHandle>(null);
  const regionRef = useRef<Region>(HOME_REGION);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Label markers (name + vibe word) once zoomed in, so color is never the only signal.
  const [labelled, setLabelled] = useState(HOME_REGION.latitudeDelta < LABEL_DELTA);

  // Read the permission without prompting (also on return from Settings); the prompt only comes
  // from the pre-permission screen.
  usePermissionRefresh();

  // Coming back from a venue clears the highlight.
  useFocusEffect(
    useCallback(() => {
      setSelectedId(null);
    }, []),
  );

  const peek = size.sheetPeek + insets.bottom;
  // Where a selected marker should sit: just under the top bar, in the strip the venue sheet leaves open.
  const markerTargetY = insets.top + size.topBarHeight + space.xxl;

  const openVenue = useCallback(
    (v: MapVenue) => {
      haptics.select();
      setSelectedId(v.id);
      // Show the map so the pan and the selected marker are visible behind the venue sheet.
      sheetRef.current?.collapse();
      const r = regionRef.current;
      const fromCenter = 0.5 - markerTargetY / height;
      mapRef.current?.animateToRegion(
        { latitude: v.lat - fromCenter * r.latitudeDelta, longitude: v.lng, latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta },
        reduceMotion ? 0 : maxDurationMs,
      );
      router.push({ pathname: "/venue/[id]", params: { id: v.id } });
    },
    [height, markerTargetY, reduceMotion],
  );

  const attribution = venues.data?.attribution ?? null;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={HOME_REGION}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
          setLabelled(r.latitudeDelta < LABEL_DELTA);
        }}
        userInterfaceStyle="dark"
        showsPointsOfInterests={false}
        showsUserLocation={location.permission === "granted" && !location.simulated}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onLongPress={
          simulateAtPress
            ? (e) => {
                haptics.select();
                simulateAtPress?.(e.nativeEvent.coordinate);
              }
            : undefined
        }
        legalLabelInsets={{ top: 0, left: space.md, right: 0, bottom: peek + space.xs }}
        accessibilityLabel="Map of bars"
      >
        {venues.data?.venues.map((v) => (
          <VenueMarker key={v.id} venue={v} selected={v.id === selectedId} labelled={labelled} reduceMotion={reduceMotion} onPress={openVenue} />
        ))}
        {location.simulated && (
          <Marker coordinate={{ latitude: location.simulated.lat, longitude: location.simulated.lng }} accessibilityLabel="Simulated location" tracksViewChanges={false}>
            <View style={styles.simDot} />
          </Marker>
        )}
      </MapView>

      <TopBar
        name={me.data?.user.displayName}
        avatarUrl={me.data?.user.avatarUrl}
        guest={guest}
        onSearch={() => sheetRef.current?.openSearch()}
        onProfile={() => router.push(guest ? "/sign-in" : "/profile")}
      />
      <View style={[styles.chips, { top: insets.top + size.topBarHeight + space.md }]} pointerEvents="box-none">
        <SimulatedLocationChip />
      </View>
      {/* Below the top bar (and the simulator chip, when shown). */}
      <OfflineBanner top={insets.top + size.topBarHeight + space.md + (location.simulated ? size.hitTarget : 0)} />

      {attribution && (
        <Pressable
          onPress={() => openExternal(attribution.url)}
          accessibilityRole="link"
          accessibilityLabel={`Venue data ${attribution.text}`}
          hitSlop={space.xs}
          style={[styles.attribution, { bottom: peek + space.xs }]}
        >
          <Text variant="caption" color="textSecondary" maxFontSizeMultiplier={1.2}>
            {attribution.text}
          </Text>
        </Pressable>
      )}

      <HomeSheet
        ref={sheetRef}
        venues={venues.data?.venues}
        attribution={attribution}
        loading={venues.isPending}
        error={venues.isError ? errorText(venues.error, "Couldn't load bars. Try again.") : null}
        onRetry={() => void venues.refetch()}
        retrying={venues.isFetching}
        sortCoords={sortCoords}
        friendsByVenue={friendsByVenue}
        onOpenVenue={openVenue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  chips: { position: "absolute", left: screenPadding, right: screenPadding },
  attribution: {
    position: "absolute",
    right: screenPadding,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.scrim,
  },
  simDot: {
    width: size.vibeDot + space.xs,
    height: size.vibeDot + space.xs,
    borderRadius: size.vibeDot,
    backgroundColor: colors.warning,
    borderWidth: size.markerRing,
    borderColor: colors.textPrimary,
  },
});
