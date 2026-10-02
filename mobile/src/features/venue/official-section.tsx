import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Accuracy, VenuePageResponse } from "@/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { DAY_NAMES, formatCents, formatClock, nightDayIndex, WEEK_ORDER } from "@/lib/format";
import { openExternal } from "@/lib/links";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

type Official = VenuePageResponse["official"];

/** Headline and one-line explanation for the accuracy score. */
export function accuracyCopy(a: Accuracy): { title: string; detail: string } {
  if (a.status === "ok") {
    return {
      title: `Cover accuracy ${a.scorePct}%`,
      detail: `The posted cover matched what people reported in ${a.matchingWindows} of ${a.qualifyingWindows} busy hours.`,
    };
  }
  if (a.status === "no_official_cover") return { title: "No official cover posted", detail: "There's nothing to compare reports against yet." };
  return { title: "Not enough data yet", detail: "Accuracy appears once enough people have reported the cover here." };
}

function hoursText(open: string, close: string): string {
  return `${formatClock(open)} – ${formatClock(close)}`;
}

export function OfficialSection({ official, now }: { official: Official; now: string }) {
  const [allHours, setAllHours] = useState(false);
  const today = nightDayIndex(new Date(now));
  const byDay = new Map(official.hours.map((h) => [h.day, h]));
  const todays = byDay.get(today);
  const accuracy = accuracyCopy(official.accuracy);

  return (
    <Section title="Details" accessory={<Badge label="From the venue" />}>
      <View style={styles.group}>
        {/* Hours */}
        <Pressable
          disabled={official.hours.length === 0}
          onPress={() => setAllHours((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: allHours }}
          accessibilityLabel={
            official.hours.length === 0
              ? "Hours not posted"
              : `Tonight: ${todays ? hoursText(todays.open, todays.close) : "Closed"}. ${allHours ? "Hide" : "Show"} all hours`
          }
          style={styles.row}
        >
          <Icon name="clock" color="textSecondary" size={size.iconSmall} />
          <View style={styles.flex}>
            <Text variant="footnote" color="textTertiary">
              Tonight
            </Text>
            <Text variant="body" weight="semibold" tabular>
              {official.hours.length === 0 ? "Hours not posted" : todays ? hoursText(todays.open, todays.close) : "Closed"}
            </Text>
          </View>
          {official.hours.length > 0 && <Icon name={allHours ? "chevron.up" : "chevron.down"} color="textTertiary" size={size.iconTiny} />}
        </Pressable>
        {allHours && (
          <View style={styles.week}>
            {WEEK_ORDER.map((i) => {
              const day = DAY_NAMES[i];
              const h = byDay.get(i);
              const isToday = i === today;
              return (
                <View key={day} style={styles.weekRow}>
                  <Text variant="subhead" color={isToday ? "textPrimary" : "textSecondary"} weight={isToday ? "semibold" : "regular"}>
                    {day}
                  </Text>
                  <Text variant="subhead" color={isToday ? "textPrimary" : "textSecondary"} weight={isToday ? "semibold" : "regular"} tabular>
                    {h ? hoursText(h.open, h.close) : "Closed"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.separator} />
        <Row icon="dollarsign.circle" label="Cover" value={official.officialCoverCents === null ? "No official cover posted" : formatCents(official.officialCoverCents)} />
        {official.dressCode && (
          <>
            <View style={styles.separator} />
            <Row icon="tshirt" label="Dress code" value={official.dressCode} />
          </>
        )}
        {official.accuracy.status !== "no_official_cover" && <View style={styles.separator} />}
        {official.accuracy.status !== "no_official_cover" && (
        <View style={styles.row} accessible accessibilityLabel={`${accuracy.title}. ${accuracy.detail}`}>
          <Icon name="checkmark.seal" color="textSecondary" size={size.iconSmall} />
          <View style={styles.flex}>
            <Text variant="body" weight="semibold" tabular>
              {accuracy.title}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {accuracy.detail}
            </Text>
          </View>
        </View>
        )}
        {official.promos.map((p) => (
          <View key={p.id}>
            <View style={styles.separator} />
            <View style={styles.row} accessible accessibilityLabel={`${p.isPaid ? "Promoted. " : ""}${p.title}. ${p.body}`}>
              <Icon name="sparkles" color="textSecondary" size={size.iconSmall} />
              <View style={styles.flex}>
                <View style={styles.promoTitle}>
                  <Text variant="body" weight="semibold" style={styles.shrink}>
                    {p.title}
                  </Text>
                  {p.isPaid && <Badge label="Promoted" />}
                </View>
                <Text variant="footnote" color="textSecondary">
                  {p.body}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {official.attribution && (
        <Pressable onPress={() => openExternal(official.attribution!.url)} accessibilityRole="link" style={styles.attribution}>
          <Text variant="caption" color="textTertiary">
            Venue data {official.attribution.text}
          </Text>
        </Pressable>
      )}
    </Section>
  );
}

function Row({ icon, label, value }: { icon: "dollarsign.circle" | "tshirt"; label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} color="textSecondary" size={size.iconSmall} />
      <View style={styles.flex}>
        <Text variant="footnote" color="textTertiary">
          {label}
        </Text>
        <Text variant="body" tabular>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, backgroundColor: colors.elevated, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget + space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md + size.iconSmall + space.sm },
  week: { paddingLeft: space.md + size.iconSmall + space.sm, paddingRight: space.md, paddingBottom: space.sm, gap: space.xs },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  promoTitle: { flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" },
  shrink: { flexShrink: 1 },
  attribution: { minHeight: size.hitTarget, justifyContent: "center" },
  flex: { flex: 1, gap: space.xxs },
});
