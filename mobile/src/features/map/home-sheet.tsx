import BottomSheet, { BottomSheetTextInput, useBottomSheet, useBottomSheetScrollableCreator, useBottomSheetSpringConfigs } from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Attribution, MapVenue } from "@/api/contracts";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VibeDot } from "@/components/venue/vibe-dot";
import { useLocationState } from "@/features/location/location-store";
import { formatDistance, NO_DATA_SPOKEN, plural, VIBE_LABEL, venueSummary } from "@/lib/format";
import { distanceMeters, type Coords } from "@/lib/geo";
import { openExternal } from "@/lib/links";
import { colors, hairlineWidth, maxFontSizeMultiplier, radius, screenPadding, size, space, spring, type as typeScale } from "@/theme";
import { LIST_MODES, searchVenues, sortVenues, summaryLine, type ListMode } from "./venue-list";

export type HomeSheetHandle = { openSearch: () => void; collapse: () => void };

type Props = {
  venues: MapVenue[] | undefined;
  attribution: Attribution | null;
  loading: boolean;
  /** Set when the latest fetch failed. Shown in place when there's no data, as a notice when there is. */
  error: string | null;
  onRetry: () => void;
  retrying: boolean;
  /** Position for the Nearby sort; the caller keeps it stable (it only changes after real movement). */
  sortCoords: Coords | null;
  friendsByVenue: Map<string, string[]>;
  onOpenVenue: (venue: MapVenue) => void;
};

const PEEK = 0;
const FULL = 2;
const SNAP_NAMES = ["collapsed", "half open", "expanded"];

type SearchInputRef = ComponentRef<typeof BottomSheetTextInput>;

export const HomeSheet = forwardRef<HomeSheetHandle, Props>(function HomeSheet(props, ref) {
  const { venues, attribution, loading, error, onRetry, retrying, sortCoords, friendsByVenue, onOpenVenue } = props;
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const searchRef = useRef<SearchInputRef>(null);
  const focusPending = useRef(false);
  const [mode, setMode] = useState<ListMode>("live");
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(PEEK);
  const location = useLocationState();

  const snapPoints = useMemo(() => [size.sheetPeek + insets.bottom, "50%", "100%"], [insets.bottom]);
  // Reanimated springs already honor the system Reduce Motion setting.
  const animationConfigs = useBottomSheetSpringConfigs(spring.sheet);
  const renderScrollComponent = useBottomSheetScrollableCreator();

  const focusSearch = () => requestAnimationFrame(() => searchRef.current?.focus());

  useImperativeHandle(ref, () => ({
    openSearch: () => {
      if (index === FULL) return focusSearch();
      // The field mounts when the sheet reaches full height; focus it then (see onChange).
      focusPending.current = true;
      sheetRef.current?.snapToIndex(FULL);
    },
    collapse: () => {
      Keyboard.dismiss();
      sheetRef.current?.snapToIndex(PEEK);
    },
  }));

  const searching = query.trim().length > 0;
  const showSearch = index === FULL || (searching && index > PEEK);
  const needsLocation = mode === "nearby" && !sortCoords && !searching;

  const rows = useMemo(() => {
    if (!venues) return [];
    return searching ? searchVenues(venues, query) : sortVenues(venues, mode, sortCoords);
  }, [venues, searching, query, mode, sortCoords]);

  const renderItem = useCallback(
    ({ item }: { item: MapVenue }) => (
      <VenueRow
        venue={item}
        friends={friendsByVenue.get(item.slug)}
        distance={mode === "nearby" && sortCoords ? distanceMeters(sortCoords, { lat: item.lat, lng: item.lng }) : null}
        onPress={onOpenVenue}
      />
    ),
    [friendsByVenue, mode, sortCoords, onOpenVenue],
  );

  const Handle = useCallback(() => <SheetHandle index={index} />, [index]);

  let body: React.ReactNode;
  if (!venues && loading) body = <SkeletonRows />;
  else if (!venues && error) body = <InlineError message={error} onRetry={onRetry} retrying={retrying} />;
  else if (needsLocation) body = <LocationPrompt denied={location.permission === "denied"} />;
  else if (searching && rows.length === 0)
    body = <EmptyState text={`No bars match "${query.trim()}".`} action={<Button title="Clear search" variant="plain" compact block={false} onPress={() => setQuery("")} />} />;
  else if (venues && venues.length === 0) body = <EmptyState text="No bars to show yet." action={<Button title="Refresh" variant="plain" compact block={false} onPress={onRetry} />} />;
  else body = null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={PEEK}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animationConfigs={animationConfigs}
      topInset={insets.top}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      onChange={(i) => {
        setIndex(i);
        if (i === FULL && focusPending.current) {
          focusPending.current = false;
          focusSearch();
        }
        if (i === PEEK) {
          // Back to the peek: the summary and segments are all that fit.
          Keyboard.dismiss();
          setQuery("");
        }
      }}
      backgroundStyle={styles.background}
      handleComponent={Handle}
    >
      <View style={styles.header}>
        {!venues && error ? (
          // Visible at the peek, so a failed load never looks like an empty map.
          <View style={styles.errorRow}>
            <Text variant="headline" style={styles.shrink} numberOfLines={1}>
              Couldn&apos;t load bars
            </Text>
            <Button title="Retry" variant="plain" compact block={false} loading={retrying} onPress={onRetry} />
          </View>
        ) : (
          <Text variant="headline" accessibilityRole="header" numberOfLines={1}>
            {venues ? summaryLine(venues) : "Finding what\u2019s live"}
          </Text>
        )}
        {!searching && <SegmentedControl segments={LIST_MODES} value={mode} onChange={setMode} accessibilityLabel="Sort venues" />}
        {showSearch && (
          <View style={styles.search}>
            <Icon name="magnifyingglass" color="textTertiary" size={size.iconSmall} />
            <BottomSheetTextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search bars"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              keyboardAppearance="dark"
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Search bars"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              style={styles.searchInput}
            />
          </View>
        )}
        {venues && error && (
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`${error} Tap to retry.`} style={styles.stale}>
            <Icon name="arrow.clockwise" color="textTertiary" size={size.iconTiny} />
            <Text variant="footnote" color="textTertiary">
              Couldn&apos;t refresh. Tap to try again.
            </Text>
          </Pressable>
        )}
      </View>
      {body ? (
        <View style={styles.pad}>{body}</View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          renderScrollComponent={renderScrollComponent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          ItemSeparatorComponent={Separator}
          ListFooterComponent={attribution ? <AttributionFooter attribution={attribution} /> : null}
        />
      )}
    </BottomSheet>
  );
});

/** Grab handle that VoiceOver can adjust (swipe up/down to expand or collapse the list). */
function SheetHandle({ index }: { index: number }) {
  const { snapToIndex } = useBottomSheet();
  const current = Math.max(0, index);
  return (
    <View
      style={styles.handleWrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Venue list"
      accessibilityValue={{ text: SNAP_NAMES[current] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") snapToIndex(Math.min(FULL, current + 1));
        if (e.nativeEvent.actionName === "decrement") snapToIndex(Math.max(PEEK, current - 1));
      }}
    >
      <View style={styles.handle} />
    </View>
  );
}

type RowProps = { venue: MapVenue; friends: string[] | undefined; distance: number | null; onPress: (v: MapVenue) => void };

const VenueRow = memo(function VenueRow({ venue, friends, distance, onPress }: RowProps) {
  const summary = venueSummary(venue);
  // The count is the API's (same as the map badge); names come from the following list when loaded.
  const friendNames = (friends ?? []).slice(0, venue.friendsGoing);
  const label = [
    venue.name,
    venue.vibe === "NO_DATA" ? NO_DATA_SPOKEN : VIBE_LABEL[venue.vibe],
    venue.hereNow ? `${venue.hereNow} here` : null,
    venue.goingTonight ? `${venue.goingTonight} going` : null,
    venue.friendsGoing ? `${plural(venue.friendsGoing, "friend")} going` : null,
    distance !== null ? `${formatDistance(distance)} away` : null,
    venue.promoted ? "Promoted" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      onPress={() => onPress(venue)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the venue"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <VibeDot vibe={venue.vibe} />
      <View style={styles.rowText}>
        <View style={styles.rowTitle}>
          <Text variant="headline" numberOfLines={1} style={styles.shrink}>
            {venue.name}
          </Text>
          {venue.promoted && <Badge label="Promoted" />}
        </View>
        <Text variant="subhead" color="textSecondary" numberOfLines={1} tabular>
          {distance !== null ? `${summary} · ${formatDistance(distance)}` : summary}
        </Text>
      </View>
      <AvatarStack names={friendNames} />
    </Pressable>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text variant="callout" color="textSecondary">
        {text}
      </Text>
      {action}
    </View>
  );
}

function LocationPrompt({ denied }: { denied: boolean }) {
  return (
    <EmptyState
      text={denied ? "Location is off for Nostos. Turn it on in Settings to sort by distance." : "Share your location to see the closest bars first."}
      action={
        <Button
          title={denied ? "Open Settings" : "Use my location"}
          variant="secondary"
          compact
          block={false}
          icon={denied ? "gearshape.fill" : "location.fill"}
          onPress={() => (denied ? void Linking.openSettings() : router.push("/location-permission"))}
        />
      }
    />
  );
}

function AttributionFooter({ attribution }: { attribution: Attribution }) {
  return (
    <Pressable onPress={() => openExternal(attribution.url)} accessibilityRole="link" style={styles.attribution} hitSlop={space.xs}>
      <Text variant="caption" color="textTertiary">
        Venue data {attribution.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  handleWrap: { alignItems: "center", paddingTop: space.xs, paddingBottom: space.sm },
  handle: { backgroundColor: colors.textTertiary, width: size.sheetHandle, height: size.sheetHandleHeight, borderRadius: radius.pill },
  header: { paddingHorizontal: screenPadding, paddingBottom: space.sm, gap: space.sm },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.hitTarget,
    paddingHorizontal: space.sm,
    borderRadius: radius.button,
    backgroundColor: colors.elevated,
  },
  searchInput: { flex: 1, ...typeScale.body, color: colors.textPrimary, paddingVertical: space.xs },
  errorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  stale: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: size.hitTarget - space.md },
  pad: { paddingHorizontal: screenPadding },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.listRow, paddingHorizontal: screenPadding, paddingVertical: space.sm },
  rowPressed: { backgroundColor: colors.pressedOverlay },
  rowText: { flex: 1, gap: space.xxs },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: space.xs },
  shrink: { flexShrink: 1 },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: screenPadding + size.vibeDot + space.md },
  empty: { gap: space.sm, paddingVertical: space.lg, alignItems: "flex-start" },
  attribution: { paddingHorizontal: screenPadding, paddingVertical: space.lg },
});
