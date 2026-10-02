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
import { colors, radius, screenPadding, size, space } from "@/theme";

/** Your page for one place: your stamps there, night by night, and whether you are inside its geofence right now. */
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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: data?.place.name ?? "Place" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {data ? (
          <>
            <View style={styles.head}>
              <Text variant="largeTitle" color="brass" accessibilityRole="header">
                {data.place.name}
              </Text>
              <Text variant="typewriterSmall" color="textSecondary">
                {[data.place.neighborhood, data.place.address].filter(Boolean).join(" · ")}
              </Text>
              {stand?.text ? (
                <Text variant="typewriter" color={stand.canStamp ? "brass" : "dimBrass"} accessibilityLiveRegion="polite">
                  {stand.text}
                </Text>
              ) : null}
              {stand?.canStamp ? <Button title="Stamp here" icon="seal.fill" block={false} onPress={() => router.push("/stamp/new")} /> : null}
            </View>

            {summary ? (
              <Text variant="typewriterSmall" color="dimBrass">
                {summary.toUpperCase()}
              </Text>
            ) : (
              <Text variant="callout" color="textSecondary">
                You haven&apos;t stamped this place yet.
              </Text>
            )}

            {data.visits.map((visit) => (
              <View key={visit.day} style={styles.night}>
                <Text variant="serifLabel" color="brass" accessibilityRole="header">
                  {dayLabel(visit.day)}
                </Text>
                {visit.stamps.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: "/stamp/[id]", params: { id: s.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Stamp, ${stampLine(s)}`}
                    accessibilityHint="Opens the stamp"
                    style={styles.row}
                  >
                    <StampMark input={{ placeId: s.place.id, placeName: s.place.name, neighborhoodId: s.place.neighborhoodId, neighborhoodName: s.place.neighborhood }} size={size.avatarLarge} />
                    <Text variant="typewriter" color="textPrimary" style={styles.line} numberOfLines={3}>
                      {stampLine(s)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : q.isError ? (
          <InlineError message={errorText(q.error, "Couldn't load this place.")} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : (
          <View style={styles.head} accessible accessibilityRole="progressbar" accessibilityLabel="Loading this place">
            <Skeleton width="70%" height={size.iconLarge} />
            <Skeleton width="45%" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.xxxl },
  head: { gap: space.xs },
  night: { gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.hitTarget },
  line: { flex: 1 },
});
