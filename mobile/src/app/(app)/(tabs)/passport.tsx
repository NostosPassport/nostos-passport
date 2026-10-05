import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { DisplayTitle, EditorialHeader, EditorialSafeContent, EditorialScreen, GearButton, Kicker, Rule } from "@/components/editorial/editorial";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { usePassport } from "@/features/book/use-passport";
import { colors, fonts } from "@/theme";

export default function Passport() {
  const data = usePassport();
  const last = data.stamps.at(-1);
  const lastDate = last ? new Date(last.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" }).toUpperCase() : "";

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

        <View style={styles.stage} accessibilityLabel="Passport collection preview">
          <Corner style={styles.topLeft} />
          <Corner style={styles.topRight} flipX />
          <Corner style={styles.bottomLeft} flipY />
          <Corner style={styles.bottomRight} flipX flipY />
          {data.status === "pending" ? <Skeleton width="100%" height={230} /> : null}
          {data.status === "error" ? <InlineError message="Couldn't open your passport." onRetry={data.retry} /> : null}
        </View>

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
});
