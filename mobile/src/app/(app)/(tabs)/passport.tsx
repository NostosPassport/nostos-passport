import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { StampView } from "@/api/contracts";
import { DisplayTitle, EditorialButton, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { usePassport } from "@/features/book/use-passport";
import { colors, fonts } from "@/theme";

export default function Passport() {
  const data = usePassport();
  const [open, setOpen] = useState(false);
  const [spread, setSpread] = useState(1);
  const [showIndex, setShowIndex] = useState(false);
  const last = data.stamps.at(-1);
  const lastDate = last ? new Date(last.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" }).toUpperCase() : "";

  if (open) {
    return <OpenPassport stamps={data.stamps} spread={spread} onSpread={setSpread} showIndex={showIndex} onIndex={setShowIndex} onClose={() => setOpen(false)} />;
  }

  return (
    <EditorialScreen>
      <EditorialSafeContent>
        <EditorialHeader action={<GearButton onPress={() => router.push("/settings")} />} />
        <Rule />
        <View style={styles.archiveLine}>
          <Kicker>NEW YORK</Kicker>
          <Kicker>PRIVATE COLLECTION</Kicker>
        </View>
        <DisplayTitle size={78} style={styles.title}>A life,{`\n`}collected.</DisplayTitle>

        <Pressable
          style={styles.stage}
          accessibilityRole="button"
          accessibilityLabel={data.stamps.length ? "Open your passport" : "Stamp your first place"}
          onPress={() => (data.stamps.length ? setOpen(true) : router.push("/stamp/new"))}
          disabled={data.status !== "ready"}
        >
          <Corner style={styles.topLeft} />
          <Corner style={styles.topRight} flipX />
          <Corner style={styles.bottomLeft} flipY />
          <Corner style={styles.bottomRight} flipX flipY />
          {data.status === "pending" ? <Skeleton width="100%" height={230} /> : null}
          {data.status === "error" ? <InlineError message="Couldn't open your passport." onRetry={data.retry} /> : null}
          {data.status === "ready" ? <Kicker>{data.stamps.length ? "OPEN PASSPORT" : "ADD YOUR FIRST STAMP"}</Kicker> : null}
        </Pressable>

        <View style={styles.stats}>
          <Stat value={data.counts.stamps} label="STAMPS" />
          <View style={styles.statRule} />
          <Stat value={data.counts.places} label="PLACES" />
          <View style={styles.statRule} />
          <Stat value={data.counts.neighborhoods} label="NEIGHBORHOODS" />
        </View>
        <Rule />
        <View style={styles.lastVisit}>
          <Kicker>LAST VISIT</Kicker>
          <Kicker>{last?.place.name?.toUpperCase() ?? "NO VISITS YET"}</Kicker>
          <Kicker>{lastDate}</Kicker>
        </View>
        <Rule />
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

function OpenPassport({ stamps, spread, onSpread, showIndex, onIndex, onClose }: { stamps: StampView[]; spread: number; onSpread: (spread: number) => void; showIndex: boolean; onIndex: (show: boolean) => void; onClose: () => void }) {
  const maxPage = Math.max(1, ...stamps.map((stamp) => stamp.page ?? 1));
  const maxSpread = Math.max(1, Math.ceil(maxPage / 2));
  const leftPage = (spread - 1) * 2 + 1;
  const rightPage = leftPage + 1;
  const spreadStamps = useMemo(() => stamps.filter((stamp) => stamp.page === leftPage || stamp.page === rightPage), [leftPage, rightPage, stamps]);

  return (
    <EditorialScreen>
      <EditorialSafeContent>
        <View style={styles.openNav}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close passport" style={styles.backTarget}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
        </View>
        <DisplayTitle size={50} style={styles.openTitle}>Your passport</DisplayTitle>
        <Text style={styles.openSubtitle}>{showIndex ? "Memory index · your collection" : `Pages ${leftPage}–${rightPage} · your collection`}</Text>

        <View style={styles.openStage}>
          {showIndex ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.indexList}>
              {stamps.length ? stamps.map((stamp, index) => <MemoryRow key={stamp.id} stamp={stamp} number={index + 1} />) : <EmptyPassport />}
            </ScrollView>
          ) : spreadStamps.length ? (
            <View style={styles.spread}>
              <PageColumn page={leftPage} stamps={spreadStamps.filter((stamp) => stamp.page === leftPage)} />
              <View style={styles.spine} />
              <PageColumn page={rightPage} stamps={spreadStamps.filter((stamp) => stamp.page === rightPage)} />
            </View>
          ) : (
            <EmptyPassport />
          )}
        </View>

        <View style={styles.pager}>
          <EditorialButton label="Previous" outline disabled={showIndex || spread <= 1} onPress={() => onSpread(Math.max(1, spread - 1))} style={styles.pagerButton} />
          <EditorialButton label={showIndex ? "Spread" : "Index"} outline onPress={() => onIndex(!showIndex)} style={styles.pagerButton} />
          <EditorialButton label="Next" outline disabled={showIndex || spread >= maxSpread} onPress={() => onSpread(Math.min(maxSpread, spread + 1))} style={styles.pagerButton} />
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.closePassport}>
          <Text style={styles.closeText}>Close passport</Text>
        </Pressable>
      </EditorialSafeContent>
    </EditorialScreen>
  );
}

function PageColumn({ page, stamps }: { page: number; stamps: StampView[] }) {
  const bySlot = new Map(stamps.map((stamp) => [stamp.slot ?? 1, stamp]));
  return (
    <View style={styles.pageColumn}>
      {[1, 2, 3].map((slot) => {
        const stamp = bySlot.get(slot);
        return stamp ? <MemoryTile key={stamp.id} stamp={stamp} /> : <View key={`${page}-${slot}`} style={styles.emptySlot} />;
      })}
      <Kicker>{String(page).padStart(2, "0")}</Kicker>
    </View>
  );
}

function MemoryTile({ stamp }: { stamp: StampView }) {
  const date = new Date(stamp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  return (
    <Pressable onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })} accessibilityRole="button" accessibilityLabel={`${stamp.place.name}, ${date}`} style={({ pressed }) => [styles.memoryTile, pressed && styles.pressed]}>
      <Text style={styles.memoryPlace} numberOfLines={2}>{stamp.place.name}</Text>
      <Text style={styles.memoryMeta} numberOfLines={1}>{stamp.place.neighborhood} · {date}</Text>
    </Pressable>
  );
}

function MemoryRow({ stamp, number }: { stamp: StampView; number: number }) {
  return (
    <Pressable onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: stamp.id } })} accessibilityRole="button" style={({ pressed }) => [styles.memoryRow, pressed && styles.pressed]}>
      <Kicker>NO. {String(number).padStart(3, "0")}</Kicker>
      <View style={styles.memoryRowCopy}>
        <Text style={styles.rowPlace}>{stamp.place.name}</Text>
        <Text style={styles.memoryMeta}>{stamp.place.neighborhood} · {new Date(stamp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
      </View>
    </Pressable>
  );
}

function EmptyPassport() {
  return (
    <View style={styles.emptyPassport}>
      <Kicker>NO MEMORIES ON THESE PAGES</Kicker>
      <Text style={styles.emptyCopy}>Your stamps will collect here as you make them.</Text>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Corner({ style, flipX, flipY }: { style: object; flipX?: boolean; flipY?: boolean }) {
  return <View style={[styles.corner, style, { transform: [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }] }]} />;
}

const styles = StyleSheet.create({
  archiveLine: { height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { marginTop: 4 },
  stage: { flex: 1, minHeight: 230, marginTop: 14, marginBottom: 14, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 14, height: 14, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.textSecondary },
  topLeft: { left: 0, top: 0 },
  topRight: { right: 0, top: 0 },
  bottomLeft: { left: 0, bottom: 0 },
  bottomRight: { right: 0, bottom: 0 },
  stats: { height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center", gap: 1 },
  statValue: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 32, lineHeight: 34 },
  statLabel: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 10, lineHeight: 13, letterSpacing: 1.1 },
  statRule: { width: StyleSheet.hairlineWidth, height: 47, backgroundColor: colors.hairline },
  lastVisit: { height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  openNav: { height: 44, justifyContent: "center" },
  backTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11 },
  backGlyph: { color: colors.textPrimary, fontSize: 32, lineHeight: 34 },
  openTitle: { marginTop: 8 },
  openSubtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 17, marginTop: 4, marginBottom: 18 },
  openStage: { height: 320, width: "100%", overflow: "hidden" },
  spread: { flex: 1, flexDirection: "row" },
  spine: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginHorizontal: 7 },
  pageColumn: { flex: 1, paddingVertical: 5, gap: 8 },
  memoryTile: { flex: 1, minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, justifyContent: "center", gap: 5, paddingHorizontal: 5 },
  emptySlot: { flex: 1, minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  memoryPlace: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 22, lineHeight: 22 },
  memoryMeta: { color: colors.textSecondary, fontSize: 10, lineHeight: 13 },
  pager: { height: 48, flexDirection: "row", gap: 8, marginTop: 12 },
  pagerButton: { flex: 1 },
  closePassport: { height: 48, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
  indexList: { gap: 0 },
  memoryRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: 8 },
  memoryRowCopy: { flex: 1, gap: 3 },
  rowPlace: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 23, lineHeight: 25 },
  emptyPassport: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 28 },
  emptyCopy: { color: colors.textSecondary, fontSize: 13, lineHeight: 17, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
