import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { usePlacePage } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { AccountGate } from "@/features/account/account-gate";
import { StampMark } from "@/features/book/StampMark";
import { useUserCoords } from "@/features/location/location-store";
import { dayLabel, stampLine, standing, visitSummary } from "@/features/place/place-page";
import { formatDistance } from "@/lib/format";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, radius, screenPadding, size, space } from "@/theme";

export default function PlacePage() {
  return (
    <AccountGate title="Place" message="Sign in to see your stamps at this place.">
      <Page />
    </AccountGate>
  );
}

function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const here = useUserCoords();
  const q = usePlacePage(id ?? "", here);
  const data = q.data;
  const stand = data ? standing(data, formatDistance) : null;
  const summary = data ? visitSummary(data.visits) : null;
  const cuisines = data?.place.cuisines ?? [];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: data?.place.name ?? "Place" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {data ? (
          <>
            <View style={styles.head}>
              <Text variant="largeTitle" color="brass" accessibilityRole="header">{data.place.name}</Text>
              {cuisines.length > 0 ? <Text variant="typewriterSmall" color="brass">{cuisines.join(" · ")}</Text> : null}
              <Text variant="typewriterSmall" color="textSecondary">{[localityLabel(data.place), data.place.address].filter(Boolean).join(" · ")}</Text>
              {stand?.text ? (
                <Text variant="typewriter" color={stand.canVerify ? "brass" : "dimBrass"} accessibilityLiveRegion="polite">{stand.text}</Text>
              ) : null}
              <Button title="Stamp this place" icon="seal.fill" block={false} onPress={() => router.push("/stamp/new")} />
              {!stand?.canVerify ? <Text variant="footnote" color="textTertiary">You can still make an unverified Now stamp or add a Past visit.</Text> : null}
            </View>

            {summary ? <Text variant="typewriterSmall" color="dimBrass">{summary.toUpperCase()}</Text> : <Text variant="callout" color="textSecondary">You haven&apos;t stamped this place yet.</Text>}

            {data.visits.map((visit) => (
              <View key={visit.day} style={styles.visit}>
                <Text variant="serifLabel" color="brass" accessibilityRole="header">{dayLabel(visit.day)}</Text>
                {visit.stamps.map((s) => (
                  <Pressable key={s.id} onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: s.id } })} accessibilityRole="button" accessibilityLabel={`Stamp, ${stampLine(s)}${s.verified ? ", visit verified" : ""}`} accessibilityHint="Opens the stamp" style={styles.row}>
                    <StampMark input={{ placeId: s.place.id, placeName: s.place.name, localityKey: localityKey(s.place), localityName: localityLabel(s.place) }} size={size.avatarLarge} artwork={s.artwork} photoUrl={s.photoUrl} visitedAt={s.visitedAt} timeZone={s.place.timeZone} />
                    <View style={styles.line}><Text variant="typewriter" color="textPrimary" numberOfLines={3}>{stampLine(s)}</Text>{s.verified ? <Text variant="footnote" color="accent">Nostos verified</Text> : null}</View>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : q.isError ? (
          <InlineError message={errorText(q.error, "Couldn't load this place.")} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : (
          <View style={styles.head} accessible accessibilityRole="progressbar" accessibilityLabel="Loading this place"><Skeleton width="70%" height={size.iconLarge} /><Skeleton width="45%" /></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.xxxl },
  head: { gap: space.xs },
  visit: { gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.hitTarget },
  line: { flex: 1, gap: space.xxs },
});
