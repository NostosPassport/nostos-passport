import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";

import type { StampView } from "@/api/contracts";
import { Body, DisplayTitle, EditorialButton, Wordmark, EditorialSafeContent, EditorialScreen, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { StampMark, fitStampSize } from "@/features/book/StampMark";
import { useCollections } from "@/api/queries";
import { InlineError } from "@/components/ui/inline-error";
import { ScreenState } from "@/components/ui/screen-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text as UIText } from "@/components/ui/text";
import { collectionColorValue } from "@/features/collections/colors";
import { usePassport } from "@/features/book/use-passport";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, fonts, hairlineWidth, maxFontSizeMultiplier, radius, size, space, pressedOpacity } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

type Filter = "all" | "restaurant" | "bar" | "hotel";
type Tab = "stamps" | "collections";
/** The stamp's box in a gallery row. A square bar stamp at full width would dwarf the landscape restaurant ones. */
const MARK_WIDTH = 112;
const MARK_HEIGHT = 88;
const TABS: { key: Tab; label: string }[] = [{ key: "stamps", label: "STAMPS" }, { key: "collections", label: "COLLECTIONS" }];

/** The gallery: two swipeable pages, every stamp and every collection. */
export default function Gallery() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial: Tab = params.tab === "collections" ? "collections" : "stamps";
  const [tab, setTab] = useState<Tab>(initial);
  const [pageWidth, setPageWidth] = useState(0);
  const pager = useRef<ScrollViewInstance>(null);
  const show = (next: Tab) => {
    setTab(next);
    pager.current?.scrollTo({ x: next === "collections" ? pageWidth : 0, animated: true });
  };

  return (
    <EditorialScreen>
      <EditorialSafeContent bottom>
        <View style={styles.topBar}>
          <Tappable onPress={() => nav.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconTarget}>
            <Icon name="chevron.left" color="textPrimary" size={size.iconSmall} />
          </Tappable>
          <Wordmark compact />
          <View style={styles.iconTarget} />
        </View>
        <Rule />
        <DisplayTitle size={48} style={styles.title}>Gallery.</DisplayTitle>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((t) => (
            <Tappable key={t.key} onPress={() => show(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <Kicker muted={tab !== t.key}>{t.label}</Kicker>
            </Tappable>
          ))}
        </View>
        <View style={styles.listView} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
          {pageWidth > 0 ? (
            <ScrollView
              ref={pager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: initial === "collections" ? pageWidth : 0, y: 0 }}
              onMomentumScrollEnd={(e) => setTab(e.nativeEvent.contentOffset.x > pageWidth / 2 ? "collections" : "stamps")}
            >
              <View style={{ width: pageWidth }}><StampsPage /></View>
              <View style={{ width: pageWidth }}><CollectionsList /></View>
            </ScrollView>
          ) : null}
        </View>
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

function StampsPage() {
  const passport = usePassport();
  const [filter, setFilter] = useState<Filter>("all");
  const stamps = useMemo(() => {
    const sorted = [...passport.stamps].sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt));
    return filter === "all" ? sorted : sorted.filter((stamp) => stamp.artwork?.kind === filter);
  }, [filter, passport.stamps]);

  return (
    <View style={styles.listView}>
        <View style={styles.filters}>
          <FilterButton label="ALL" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterButton label="RESTAURANTS" active={filter === "restaurant"} onPress={() => setFilter("restaurant")} />
          <FilterButton label="BARS" active={filter === "bar"} onPress={() => setFilter("bar")} />
          <FilterButton label="HOTELS" active={filter === "hotel"} onPress={() => setFilter("hotel")} />
        </View>
        {passport.status === "pending" ? (
          <View style={styles.empty}><ScreenState kind="loading" label="Loading your stamps" /></View>
        ) : passport.status === "error" ? (
          <View style={styles.empty}><ScreenState kind="error" message="Couldn't load your stamps." onRetry={passport.retry} /></View>
        ) : (
          <FlatList
            style={styles.listView}
            data={stamps}
            keyExtractor={(stamp) => stamp.id}
            contentContainerStyle={stamps.length ? styles.list : styles.emptyList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <GalleryStamp stamp={item} />}
            ListEmptyComponent={filter === "all"
              ? <ScreenState kind="empty" title="No stamps yet" message="Stamp a restaurant, bar or hotel and it shows up here." action={{ label: "Stamp a place", onPress: () => nav.push("/stamp/new") }} />
              : <ScreenState kind="empty" title={`No ${filter} stamps yet`} />}
          />
        )}
    </View>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Tappable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filter, active && styles.filterActive]}>
      <Kicker muted={!active}>{label}</Kicker>
    </Tappable>
  );
}

function GalleryStamp({ stamp }: { stamp: StampView }) {
  const locality = localityLabel(stamp.place);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone }).format(new Date(stamp.visitedAt));
  return (
    <Tappable
      onPress={() => nav.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${stamp.place.name} stamp`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.mark}>
        <StampMark
          input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: locality }}
          size={fitStampSize(stamp.artwork, MARK_WIDTH, MARK_HEIGHT)}
          artwork={stamp.artwork}
          photoUrl={stamp.photoUrl}
          visitedAt={stamp.visitedAt}
          timeZone={stamp.place.timeZone}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={3} maxFontSizeMultiplier={maxFontSizeMultiplier}>{stamp.place.name}</Text>
        {locality ? <Text style={styles.locality} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{locality}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.date} maxFontSizeMultiplier={maxFontSizeMultiplier}>{date}</Text>
          {stamp.artwork?.kind ? <Text style={styles.kind} maxFontSizeMultiplier={maxFontSizeMultiplier}>{stamp.artwork.kind.toUpperCase()}</Text> : null}
        </View>
      </View>
      <Icon name="chevron.right" color="textTertiary" size={16} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 18, marginBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconTarget: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: space.lg, marginTop: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  tab: { minHeight: size.hitTarget, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: colors.transparent, marginBottom: -StyleSheet.hairlineWidth },
  tabActive: { borderBottomColor: colors.accent },
  // The same filter row as the map: content-sized cells with a 2pt underline. Wraps instead of overflowing at large text.
  filters: { minHeight: 48, flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
  filter: { minHeight: size.hitTarget, flexGrow: 1, flexShrink: 0, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  listView: { flex: 1 },
  list: { paddingTop: 6, paddingBottom: space.xl },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  retry: { minHeight: size.hitTarget, justifyContent: "center" },
  row: { minHeight: 142, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: 14 },
  mark: { width: MARK_WIDTH, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 27, lineHeight: 29 },
  locality: { marginTop: 5, color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 13 },
  meta: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  date: { color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  kind: { color: colors.dimBrass, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8 },
  pressed: { opacity: pressedOpacity },
});


function CollectionsList() {
  const query = useCollections();
  const collections = query.data?.collections ?? [];
  // Hold the empty state while a refetch is running, so a just-created collection never flashes "No collections yet" (P-121).
  const empty = !query.isPending && !query.isError && !query.isFetching && collections.length === 0;
  return (
    <ScrollView contentContainerStyle={collectionStyles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}>
      <Body muted size={13}>Smaller passports built from your stamps. A stamp can sit in as many as you like.</Body>
      {query.isPending ? <SkeletonRows count={3} /> : null}
      {query.isError ? <InlineError message="Couldn't load your collections." onRetry={() => void query.refetch()} /> : null}
      {empty ? <ScreenState kind="empty" icon="book" title="No collections yet" message="Make one for favorites, date nights, a trip, or anything you want to keep together." /> : null}
      {collections.length ? <View>
        {collections.map((collection) => (
          <Tappable
            key={collection.id}
            onPress={() => nav.push({ pathname: "/collections/[id]", params: { id: collection.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${collection.name}, ${collection.stampCount} ${collection.stampCount === 1 ? "stamp" : "stamps"}`}
            style={collectionStyles.row}
          >
            <View style={[collectionStyles.book, { backgroundColor: collectionColorValue(collection.color) }]}><View style={collectionStyles.bookRule} /></View>
            <View style={collectionStyles.rowText}>
              <UIText style={collectionStyles.name} numberOfLines={2}>{collection.name}</UIText>
              <UIText style={collectionStyles.count}>{collection.stampCount} {collection.stampCount === 1 ? "STAMP" : "STAMPS"}</UIText>
            </View>
            <Icon name="chevron.right" color="textTertiary" size={16} />
          </Tappable>
        ))}
      </View> : null}
      <EditorialButton label="New collection" outline onPress={() => nav.push("/collections/new")} />
    </ScrollView>
  );
}

const collectionStyles = StyleSheet.create({
  content: { paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.lg },
  row: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: 14 },
  book: { width: 58, height: 82, borderRadius: radius.chip / 2, paddingLeft: space.xs, justifyContent: "center" },
  bookRule: { width: hairlineWidth, height: "80%", backgroundColor: colors.foilHighlight },
  rowText: { flex: 1, minWidth: 0, gap: space.xs },
  name: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 27, lineHeight: 29 },
  count: { color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8 },
});
