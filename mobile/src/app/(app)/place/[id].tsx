import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { usePlacePage } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Rule } from "@/components/editorial/editorial";
import { Icon } from "@/components/ui/icon";
import { ScreenState } from "@/components/ui/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { AccountGate } from "@/features/account/account-gate";
import { StampMark } from "@/features/book/StampMark";
import { useUserCoords } from "@/features/location/location-store";
import { placeDraft } from "@/features/stamps/place-draft";
import { dayLabel, stampLine, standing, visitSummary } from "@/features/place/place-page";
import { formatDistance } from "@/lib/format";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, hairlineWidth, radius, screenPadding, shadows, size, space } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

export default function PlacePage() {
  return (
    <AccountGate title="Your visits here" message="Checking your account first.">
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
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {data ? (
          <>
            <View style={styles.head}>
              {cuisines.length > 0 ? <Text variant="typewriterSmall" color="accent">{cuisines.join(" · ").toUpperCase()}</Text> : null}
              <Text variant="largeTitle" accessibilityRole="header">{data.place.name}</Text>
              <Text variant="typewriterSmall" color="textSecondary">{[localityLabel(data.place), data.place.address].filter(Boolean).join(" · ")}</Text>
              {stand?.text ? (
                <View style={styles.standing}>
                  <Icon name={stand.canVerify ? "checkmark.seal.fill" : "location"} color={stand.canVerify ? "accent" : "textSecondary"} size={size.iconSmall} />
                  <Text variant="typewriter" color={stand.canVerify ? "accent" : "textSecondary"} accessibilityLiveRegion="polite">{stand.text}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.action}>
              <Button title="Stamp this place" icon="seal.fill" onPress={() => { placeDraft.set(data.place); nav.push("/stamp/new"); }} />
              {/* Only when we know the user is out of range; with location off there is nothing to explain. */}
              {stand?.text && !stand.canVerify ? <Text variant="footnote" color="textTertiary">You&apos;re too far away to verify this visit, but you can still stamp it or add an earlier visit.</Text> : null}
            </View>

            <Rule />

            {summary ? (
              <Text variant="typewriterSmall" color="textSecondary" accessibilityRole="header">{summary.toUpperCase()}</Text>
            ) : (
              <View style={styles.empty}>
                <Icon name="seal" color="textTertiary" size={size.iconLarge} />
                <Text variant="callout" color="textSecondary" align="center">You haven&apos;t stamped this place yet.</Text>
              </View>
            )}

            {data.visits.map((visit) => (
              <View key={visit.day} style={styles.visit}>
                <Text variant="typewriterSmall" color="textSecondary" accessibilityRole="header">{dayLabel(visit.day)}</Text>
                {visit.stamps.map((s, index) => (
                  <View key={s.id}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <Tappable onPress={() => nav.push({ pathname: "/stamp/[id]", params: { id: s.id } })} accessibilityRole="button" accessibilityLabel={`Stamp, ${stampLine(s)}${s.verified ? ", visit verified" : ""}`} accessibilityHint="Opens the stamp" style={styles.row}>
                      <StampMark input={{ placeId: s.place.id, placeName: s.place.name, localityKey: localityKey(s.place), localityName: localityLabel(s.place) }} size={size.avatarLarge} artwork={s.artwork} photoUrl={s.photoUrl} visitedAt={s.visitedAt} timeZone={s.place.timeZone} />
                      <View style={styles.line}>
                        <Text variant="typewriter" color="textPrimary" numberOfLines={3}>{stampLine(s)}</Text>
                        {s.verified ? <Text variant="typewriterSmall" color="accent">Nostos verified</Text> : null}
                      </View>
                      <Icon name="chevron.right" color="textTertiary" size={size.iconTiny} />
                    </Tappable>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : q.isError ? (
          <ScreenState kind="error" message={errorText(q.error, "Couldn't load this place.")} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : (
          <View style={styles.head} accessible accessibilityRole="progressbar" accessibilityLabel="Loading this place"><Skeleton width="30%" /><Skeleton width="70%" height={size.iconLarge} /><Skeleton width="55%" /><Skeleton width="100%" height={size.buttonHeight} /></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.xxxl },
  head: { gap: space.xs },
  standing: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xxs },
  action: { gap: space.sm },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  // A visit is a paper card, like the passport's stamp cards: raised paper, hairline edge, contact shadow.
  visit: { gap: space.xs, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xs, borderRadius: radius.chip, backgroundColor: colors.paperRaised, borderWidth: hairlineWidth, borderColor: colors.hairline, ...shadows.contact },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: size.hitTarget, paddingVertical: space.xs },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline },
  line: { flex: 1, gap: space.xxs },
});
