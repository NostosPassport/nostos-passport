import { StyleSheet, View } from "react-native";

import type { VenuePageResponse } from "@/api/contracts";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { VibeDot } from "@/components/venue/vibe-dot";
import { formatAge, formatCents, LINE_LABEL, plural, VIBE_LABEL } from "@/lib/format";
import { colors, hairlineWidth, radius, size, space, vibeColors } from "@/theme";

type Consensus = VenuePageResponse["live"]["consensus"]["vibe" | "line" | "cover"];

/** "6 reports · updated 4 min ago" / "No reports in the last hour". */
export function consensusMeta(c: Consensus, now: string): string {
  if (c.reportCount === 0 || !c.newestAt) return "No reports in the last hour";
  return `${plural(c.reportCount, "report")} · updated ${formatAge(c.newestAt, now)}`;
}

/** "Maya is going" / "Maya and Sam are going" / "Maya, Sam and 2 others are going". */
export function friendsLine(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is going`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are going`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${plural(others, "other")} are going`;
}

type Props = {
  page: VenuePageResponse;
  onToggleGoing: () => void;
  goingPending: boolean;
  goingError: string | null;
};

export function LiveSection({ page, onToggleGoing, goingPending, goingError }: Props) {
  const { live, viewer, official, now } = page;
  const vibe = live.consensus.vibe;
  const line = live.consensus.line;
  const cover = live.consensus.cover;
  const friendNames = live.friendsGoing.map((f) => f.displayName);

  return (
    <Section title="Live now">
      {vibe.status === "ok" ? (
        <View style={styles.vibe} accessible accessibilityLabel={`Vibe: ${VIBE_LABEL[vibe.value]}. ${consensusMeta(vibe, now)}`}>
          <View style={styles.vibeRow}>
            <VibeDot vibe={vibe.value} dotSize={size.iconSmall} />
            <Text variant="largeTitle" style={{ color: vibeColors[vibe.value] }}>
              {VIBE_LABEL[vibe.value]}
            </Text>
          </View>
          <Text variant="footnote" color="textTertiary" tabular>
            {consensusMeta(vibe, now)}
          </Text>
        </View>
      ) : (
        <View style={styles.vibe} accessible accessibilityLabel={`Vibe: not enough data. ${consensusMeta(vibe, now)}`}>
          <View style={styles.vibeRow}>
            <VibeDot vibe="NO_DATA" dotSize={size.iconSmall} />
            <Text variant="title" color="textSecondary">
              Not enough data
            </Text>
          </View>
          <Text variant="footnote" color="textTertiary" tabular>
            {consensusMeta(vibe, now)}
          </Text>
        </View>
      )}

      <View style={styles.group}>
        <Row
          label="Line"
          value={line.status === "ok" ? (line.value === "NONE" ? "No line" : `${LINE_LABEL[line.value]} wait`) : "Not enough data"}
          meta={consensusMeta(line, now)}
          muted={line.status !== "ok"}
        />
        <View style={styles.separator} />
        <Row label="Cover" value={cover.status === "ok" ? formatCents(cover.value) : "Not enough data"} meta={consensusMeta(cover, now)} muted={cover.status !== "ok"}>
          {live.coverMismatch && official.officialCoverCents !== null && cover.status === "ok" && (
            <View
              style={styles.mismatch}
              accessible
              accessibilityLabel={`Venue says ${formatCents(official.officialCoverCents)}. People say ${formatCents(cover.value)}.`}
            >
              <Icon name="exclamationmark.triangle.fill" color="warning" size={size.iconTiny} />
              <Text variant="subhead" weight="semibold" tabular style={styles.flex}>
                Venue says {formatCents(official.officialCoverCents)} · People say {formatCents(cover.value)}
              </Text>
            </View>
          )}
        </Row>
      </View>

      <View style={styles.counts} accessible accessibilityLabel={`${live.hereNow} here now, ${live.goingTonight} going tonight`}>
        <Count icon="person.2.fill" value={live.hereNow} label="here now" />
        <Count icon="calendar" value={live.goingTonight} label="going tonight" />
      </View>

      {friendNames.length > 0 && (
        <View style={styles.friends} accessible accessibilityLabel={friendsLine(friendNames)}>
          <AvatarStack names={friendNames} />
          <Text variant="subhead" color="textSecondary" style={styles.flex}>
            {friendsLine(friendNames)}
          </Text>
        </View>
      )}

      {!viewer.ownsVenue && (
        <View style={styles.going}>
          <Button
            title={viewer.going ? "Going" : "I'm going"}
            icon={viewer.going ? "checkmark" : "plus"}
            variant={viewer.going ? "secondary" : "primary"}
            onPress={onToggleGoing}
            accessibilityState={{ selected: viewer.going, busy: goingPending }}
            accessibilityHint={viewer.going ? "Removes you from tonight's list" : "Tells your mutual follows you're going tonight"}
          />
          {goingError && (
            <Text variant="footnote" color="danger">
              {goingError}
            </Text>
          )}
        </View>
      )}
    </Section>
  );
}

function Row({ label, value, meta, muted, children }: { label: string; value: string; meta: string; muted: boolean; children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain} accessible accessibilityLabel={`${label}: ${value}. ${meta}`}>
        <View style={styles.flex}>
          <Text variant="body" color="textSecondary">
            {label}
          </Text>
          <Text variant="footnote" color="textTertiary" tabular>
            {meta}
          </Text>
        </View>
        <Text variant="title2" color={muted ? "textTertiary" : "textPrimary"} tabular style={styles.value}>
          {value}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Count({ icon, value, label }: { icon: "person.2.fill" | "calendar"; value: number; label: string }) {
  return (
    <View style={styles.count}>
      <Icon name={icon} color="textSecondary" size={size.iconSmall} />
      <Text variant="callout" tabular>
        <Text variant="callout" weight="semibold" tabular>
          {value}
        </Text>{" "}
        <Text variant="callout" color="textSecondary">
          {label}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vibe: { gap: space.xxs },
  vibeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  group: { borderRadius: radius.card, backgroundColor: colors.elevated },
  row: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs, minHeight: size.listRow },
  rowMain: { flexDirection: "row", alignItems: "center", gap: space.md },
  value: { flexShrink: 1, textAlign: "right" },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
  mismatch: { flexDirection: "row", alignItems: "center", gap: space.xs },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  count: { flexDirection: "row", alignItems: "center", gap: space.xs },
  friends: { flexDirection: "row", alignItems: "center", gap: space.sm },
  going: { gap: space.xs },
  flex: { flex: 1 },
});
