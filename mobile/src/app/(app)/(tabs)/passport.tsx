import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import type { StampView } from "@/api/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { PassportBook } from "@/features/book/PassportBook";
import { StampMark } from "@/features/book/StampMark";
import { usePassport } from "@/features/book/use-passport";
import { nav } from "@/lib/nav";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, fonts, hairlineWidth, maxFontSizeMultiplier, radius, shadows, size, space } from "@/theme";

/**
 * Home: a greeting with the avatar (which opens settings) above the 3D passport, and the newest stamps below it,
 * with a way into the gallery.
 */
export default function Passport() {
  return (
    <View style={styles.root}>
      <PassportBook top={<HomeHeader />} bottom={<StampShelf />} />
    </View>
  );
}

const SHELF_LIMIT = 12;
const CARD_WIDTH = 112;
const MARK_SIZE = 96;
const MARK_BOX = 78;

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

function HomeHeader() {
  const passport = usePassport();
  const name = firstName(passport.displayName);
  return (
    <View style={styles.header}>
      <View style={styles.greeting}>
        <Text variant="typewriterSmall" color="dimBrass" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {name ? `HELLO, ${name.toUpperCase()}` : "HELLO"}
        </Text>
        <Text variant="title2" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>Where to next?</Text>
      </View>
      <Tappable onPress={() => nav.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings and profile" hitSlop={space.xs} style={styles.avatar}>
        <Avatar name={passport.displayName} uri={passport.avatarUrl} size={size.avatar} />
      </Tappable>
    </View>
  );
}

function StampShelf() {
  const passport = usePassport();
  const recent = useMemo(
    () => [...passport.stamps].sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt)).slice(0, SHELF_LIMIT),
    [passport.stamps],
  );
  const count = passport.counts.stamps;
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        <View style={styles.shelfTitle}>
          <Text variant="title2" maxFontSizeMultiplier={maxFontSizeMultiplier}>My stamps</Text>
          <Text variant="typewriterSmall" color="textTertiary" tabular maxFontSizeMultiplier={maxFontSizeMultiplier}>{count}</Text>
        </View>
        <Tappable onPress={() => nav.push("/gallery")} accessibilityRole="button" accessibilityLabel="See all stamps and collections" hitSlop={space.xs} style={styles.seeAll}>
          <Text variant="typewriterSmall" color="accent" maxFontSizeMultiplier={maxFontSizeMultiplier}>SEE ALL</Text>
          <Icon name="arrow.right" color="accent" size={12} />
        </Tappable>
      </View>
      {passport.status === "ready" && recent.length === 0 ? (
        <Tappable onPress={() => nav.push("/stamp/new")} accessibilityRole="button" accessibilityLabel="Stamp your first place" style={[styles.card, styles.emptyCard]}>
          <Icon name="plus" color="accent" size={size.icon} />
          <Text variant="footnote" color="textSecondary" align="center">Tap the cover to open your passport. Your first stamp goes here.</Text>
        </Tappable>
      ) : (
        <FlatList
          horizontal
          data={recent}
          keyExtractor={(stamp) => stamp.id}
          renderItem={({ item }) => <ShelfCard stamp={item} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.list}
        />
      )}
    </View>
  );
}

function ShelfCard({ stamp }: { stamp: StampView }) {
  const locality = localityLabel(stamp.place);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: stamp.place.timeZone }).format(new Date(stamp.visitedAt));
  return (
    <Tappable
      onPress={() => nav.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${stamp.place.name}, ${date}`}
      style={styles.card}
    >
      <View style={styles.markBox}>
        <StampMark
          input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: locality }}
          size={MARK_SIZE}
          artwork={stamp.artwork}
          photoUrl={stamp.photoUrl}
          visitedAt={stamp.visitedAt}
          timeZone={stamp.place.timeZone}
        />
      </View>
      <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.2}>{stamp.place.name}</Text>
      <Text style={styles.cardDate} numberOfLines={1} maxFontSizeMultiplier={1.2}>{date.toUpperCase()}</Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xs, paddingBottom: space.xs },
  greeting: { flex: 1, minWidth: 0, gap: space.xxs },
  avatar: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  shelf: { gap: space.sm, paddingTop: space.sm },
  shelfHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: space.xs },
  shelfTitle: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  seeAll: { minHeight: size.hitTarget, flexDirection: "row", alignItems: "center", gap: space.xxs },
  list: { marginHorizontal: -space.md, flexGrow: 0 },
  row: { paddingHorizontal: space.md + space.xs, gap: space.sm, paddingBottom: space.sm },
  card: { width: CARD_WIDTH, padding: space.xs, gap: 2, borderRadius: radius.chip, backgroundColor: colors.paperRaised, borderWidth: hairlineWidth, borderColor: colors.hairline, ...shadows.contact },
  emptyCard: { width: "auto", minHeight: MARK_BOX + 40, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", gap: space.xs, marginHorizontal: space.xs },
  markBox: { height: MARK_BOX, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: space.xxs },
  cardName: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 15, lineHeight: 18 },
  cardDate: { color: colors.textTertiary, fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.8 },
});
