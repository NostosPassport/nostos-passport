import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { StampView } from "@/api/contracts";
import { Body, DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, Kicker, Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { StampMark } from "@/features/book/StampMark";
import { usePassport } from "@/features/book/use-passport";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, fonts, size, space } from "@/theme";

type Filter = "all" | "restaurant" | "bar";

export default function StampGallery() {
  const passport = usePassport();
  const [filter, setFilter] = useState<Filter>("all");
  const stamps = useMemo(() => {
    const sorted = [...passport.stamps].sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt));
    return filter === "all" ? sorted : sorted.filter((stamp) => stamp.artwork?.kind === filter);
  }, [filter, passport.stamps]);

  return (
    <EditorialScreen>
      <EditorialSafeContent bottom>
        <EditorialHeader compact action={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close gallery" style={styles.iconTarget}>
            <Icon name="xmark" color="textPrimary" size={size.iconSmall} />
          </Pressable>
        } />
        <Rule />
        <DisplayTitle size={48} style={styles.title}>Stamp gallery.</DisplayTitle>
        <Body muted size={13}>Every stamp in one scrolling view, newest first.</Body>
        <View style={styles.filters}>
          <FilterButton label="ALL" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterButton label="RESTAURANTS" active={filter === "restaurant"} onPress={() => setFilter("restaurant")} />
          <FilterButton label="BARS" active={filter === "bar"} onPress={() => setFilter("bar")} />
        </View>
        {passport.status === "pending" ? (
          <View style={styles.empty}><Body muted>Loading your stamps…</Body></View>
        ) : passport.status === "error" ? (
          <View style={styles.empty}>
            <Body muted>Couldn&apos;t load your stamps.</Body>
            <Pressable onPress={passport.retry} style={styles.retry}><Kicker>TRY AGAIN</Kicker></Pressable>
          </View>
        ) : (
          <FlatList
            style={styles.listView}
            data={stamps}
            keyExtractor={(stamp) => stamp.id}
            contentContainerStyle={stamps.length ? styles.list : styles.emptyList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <GalleryStamp stamp={item} />}
            ListEmptyComponent={<Body muted>{filter === "all" ? "Your stamps will appear here." : `No ${filter} stamps yet.`}</Body>}
          />
        )}
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filter, active && styles.filterActive]}>
      <Kicker muted={!active}>{label}</Kicker>
    </Pressable>
  );
}

function GalleryStamp({ stamp }: { stamp: StampView }) {
  const locality = localityLabel(stamp.place);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone }).format(new Date(stamp.visitedAt));
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${stamp.place.name} stamp`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.mark}>
        <StampMark
          input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: locality }}
          size={112}
          artwork={stamp.artwork}
          photoUrl={stamp.photoUrl}
          visitedAt={stamp.visitedAt}
          timeZone={stamp.place.timeZone}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={2}>{stamp.place.name}</Text>
        {locality ? <Text style={styles.locality} numberOfLines={1}>{locality}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.date}>{date}</Text>
          {stamp.artwork?.kind ? <Text style={styles.kind}>{stamp.artwork.kind.toUpperCase()}</Text> : null}
        </View>
      </View>
      <Icon name="chevron.right" color="textTertiary" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 18, marginBottom: 4 },
  iconTarget: { width: size.hitTarget, height: size.hitTarget, alignItems: "center", justifyContent: "center" },
  filters: { height: 54, flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 4 },
  filter: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.transparent },
  filterActive: { borderBottomColor: colors.accent },
  listView: { flex: 1 },
  list: { paddingTop: 6, paddingBottom: space.xl },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  retry: { minHeight: size.hitTarget, justifyContent: "center" },
  row: { minHeight: 142, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: 14 },
  mark: { width: 122, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 27, lineHeight: 29 },
  locality: { marginTop: 5, color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 13 },
  meta: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  date: { color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase" },
  kind: { color: colors.dimBrass, fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.8 },
  pressed: { opacity: 0.7 },
});
