import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

import type { MapVenue } from "@/api/contracts";
import { Text } from "@/components/ui/text";
import { NO_DATA_SPOKEN, VIBE_LABEL } from "@/lib/format";
import { colors, noDataOutline, radius, selectedMarkerScale, size, space, spring, timing, vibeColors } from "@/theme";

type Props = {
  venue: MapVenue;
  selected: boolean;
  /** Zoomed in close enough to label markers with name and vibe word. */
  labelled: boolean;
  reduceMotion: boolean;
  onPress: (venue: MapVenue) => void;
};

export function markerLabel(v: Pick<MapVenue, "name" | "vibe" | "friendsGoing" | "promoted">): string {
  const parts = [v.name, v.vibe === "NO_DATA" ? NO_DATA_SPOKEN : VIBE_LABEL[v.vibe]];
  if (v.friendsGoing > 0) parts.push(`${v.friendsGoing} ${v.friendsGoing === 1 ? "friend" : "friends"} going`);
  if (v.promoted) parts.push("promoted");
  return parts.join(", ");
}

/**
 * 28pt vibe-colored circle with a 2pt background ring. Packed venues breathe a soft glow
 * (static when Reduce Motion is on). No data is a hollow outline. An accent badge counts friends going.
 */
function VenueMarkerImpl({ venue, selected, labelled, reduceMotion, onPress }: Props) {
  // Selected always; otherwise only where it's busy, so labels don't pile up on dense blocks.
  const showLabel = selected || (labelled && (venue.vibe === "PACKED" || venue.vibe === "BUSY"));
  return (
    <Marker
      identifier={venue.id}
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      onPress={() => onPress(venue)}
      // Google Maps only; Apple Maps renders custom markers as live views. Kept off per spec.
      tracksViewChanges={false}
      zIndex={selected ? 1000 : venue.vibe === "PACKED" ? 20 : venue.vibe === "NO_DATA" ? 1 : 10}
      accessibilityLabel={markerLabel(venue)}
      accessibilityRole="button"
      // Keep the dot (not the view's center) on the coordinate when the label hangs below it.
      centerOffset={{ x: 0, y: showLabel ? (size.markerLabel + space.xxs) / 2 : 0 }}
    >
      <View style={styles.column} pointerEvents="none">
        <MarkerDot vibe={venue.vibe} friendsGoing={venue.friendsGoing} selected={selected} reduceMotion={reduceMotion} />
        {showLabel && (
          <View style={styles.label}>
            <Text variant="caption" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1}>
              {venue.name}
              <Text variant="caption" color="textSecondary" maxFontSizeMultiplier={1}>
                {" · "}
                {venue.vibe === "NO_DATA" ? "No data" : VIBE_LABEL[venue.vibe]}
              </Text>
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

export const VenueMarker = memo(
  VenueMarkerImpl,
  (a, b) =>
    a.selected === b.selected &&
    a.labelled === b.labelled &&
    a.reduceMotion === b.reduceMotion &&
    a.onPress === b.onPress &&
    a.venue.id === b.venue.id &&
    a.venue.vibe === b.venue.vibe &&
    a.venue.friendsGoing === b.venue.friendsGoing &&
    a.venue.promoted === b.venue.promoted &&
    a.venue.lat === b.venue.lat &&
    a.venue.lng === b.venue.lng &&
    a.venue.name === b.venue.name,
);

type DotProps = { vibe: MapVenue["vibe"]; friendsGoing: number; selected: boolean; reduceMotion: boolean };

export function MarkerDot({ vibe, friendsGoing, selected, reduceMotion }: DotProps) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const packed = vibe === "PACKED";

  useEffect(() => {
    scale.value = reduceMotion ? (selected ? selectedMarkerScale : 1) : withSpring(selected ? selectedMarkerScale : 1, spring.pop);
  }, [selected, reduceMotion, scale]);

  useEffect(() => {
    if (!packed) {
      cancelAnimation(glow);
      glow.value = 0;
      return;
    }
    if (reduceMotion) {
      glow.value = 0.5;
      return;
    }
    glow.value = withRepeat(withSequence(withTiming(1, { duration: timing.glowPhase }), withTiming(0.2, { duration: timing.glowPhase })), -1, false);
    return () => cancelAnimation(glow);
  }, [packed, reduceMotion, glow]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + glow.value * 0.28,
    transform: [{ scale: scale.value * (0.72 + glow.value * 0.28) }],
  }));

  const hollow = vibe === "NO_DATA";
  return (
    <View style={styles.box} pointerEvents="none">
      {packed && <Animated.View style={[styles.glow, { backgroundColor: vibeColors.PACKED }, glowStyle]} />}
      <Animated.View style={[styles.dot, hollow ? styles.hollow : { backgroundColor: vibeColors[vibe] }, dotStyle]}>
        {friendsGoing > 0 && (
          <View style={styles.badge}>
            <Text variant="caption" color="onAccent" weight="bold" tabular maxFontSizeMultiplier={1}>
              {friendsGoing > 9 ? "9+" : friendsGoing}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center", gap: space.xxs },
  label: {
    height: size.markerLabel,
    maxWidth: size.markerLabelMaxWidth,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    justifyContent: "center",
    backgroundColor: colors.scrim,
  },
  // A 44 pt tap area; the glow draws outside it so neighbours' taps aren't stolen.
  box: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center", overflow: "visible" },
  glow: {
    position: "absolute",
    top: (size.hitTarget - size.markerGlow) / 2,
    left: (size.hitTarget - size.markerGlow) / 2,
    width: size.markerGlow,
    height: size.markerGlow,
    borderRadius: size.markerGlow / 2,
  },
  dot: {
    width: size.marker,
    height: size.marker,
    borderRadius: size.marker / 2,
    borderWidth: size.markerRing,
    borderColor: colors.background,
  },
  hollow: { backgroundColor: colors.transparent, borderColor: noDataOutline },
  badge: {
    position: "absolute",
    top: -size.markerRing * 3,
    right: -size.markerRing * 3,
    minWidth: size.markerBadge,
    height: size.markerBadge,
    borderRadius: size.markerBadge / 2,
    paddingHorizontal: size.markerRing,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: size.markerRing / 2,
    borderColor: colors.background,
  },
});
