import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { errorText } from "@/api";
import { useOwnerDashboard } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useUpdateInfo } from "@/features/owner/use-update-info";
import { DAY_NAMES, WEEK_ORDER } from "@/lib/format";
import { fromHHMM, toHHMM } from "@/lib/ny-time";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

type Day = { open: boolean; from: string; to: string };
const DEFAULT: Day = { open: false, from: "17:00", to: "02:00" };

/** Hours editor, like Alarms: a day and its switch, then From and To when open. New York wall-clock. */
export default function HoursEditor() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const dash = useOwnerDashboard(venueId);
  const hours = dash.data?.venue.hours;
  if (!hours)
    return (
      <FormScreen>
        {dash.isError ? (
          <InlineError message={errorText(dash.error, "Couldn't load your hours.")} onRetry={() => void dash.refetch()} retrying={dash.isFetching} />
        ) : (
          <SkeletonRows count={7} />
        )}
      </FormScreen>
    );
  const initial: Day[] = DAY_NAMES.map((_, i) => {
    const h = hours.find((x) => x.day === i);
    return h ? { open: true, from: h.open, to: h.close } : DEFAULT;
  });
  return <HoursForm venueId={venueId} initial={initial} />;
}

function HoursForm({ venueId, initial }: { venueId: string; initial: Day[] }) {
  const [days, setDays] = useState(initial);
  const update = useUpdateInfo(venueId);
  const dirty = JSON.stringify(days) !== JSON.stringify(initial);
  const [saved, setSaved] = useState(false);
  useConfirmDiscard(dirty && !saved);
  const noneOpen = days.every((d) => !d.open);

  const set = (i: number, patch: Partial<Day>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => {
    if (!dirty || update.isPending) return;
    const body = days.flatMap((d, day) => (d.open ? [{ day, open: d.from, close: d.to }] : []));
    update.mutate(
      { hours: body },
      {
        onSuccess: () => {
          setSaved(true);
          requestAnimationFrame(() => router.back());
        },
      },
    );
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Save" bold onPress={save} disabled={!dirty || update.isPending} /> }} />
      <View style={styles.group}>
        {WEEK_ORDER.map((i, n) => {
          const d = days[i];
          const day = DAY_NAMES[i];
          return (
            <View key={i}>
              {n > 0 && <View style={styles.separator} />}
              <View style={styles.row}>
                <Text variant="body" style={styles.flex}>
                  {day}
                </Text>
                {!d.open && (
                  <Text variant="body" color="textTertiary">
                    Closed
                  </Text>
                )}
                <Switch
                  value={d.open}
                  onValueChange={(open) => set(i, { open })}
                  trackColor={{ true: colors.accent, false: colors.elevated }}
                  accessibilityLabel={`Open on ${day}`}
                />
              </View>
              {d.open && (
                <View style={styles.times}>
                  <TimeField label="From" day={day} value={d.from} onChange={(from) => set(i, { from })} />
                  <TimeField label="To" day={day} value={d.to} onChange={(to) => set(i, { to })} />
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Text variant="footnote" color="textTertiary">
        New York time. A closing time earlier than the opening time means the next morning.
        {noneOpen ? " With every day off, your page shows “Hours not posted”." : ""}
      </Text>
      {update.error && <InlineError message={errorText(update.error, "Couldn't save your hours.")} />}
    </FormScreen>
  );
}

function TimeField({ label, day, value, onChange }: { label: string; day: string; value: string; onChange: (hhmm: string) => void }) {
  return (
    <View style={styles.time}>
      <Text variant="subhead" color="textSecondary">
        {label}
      </Text>
      <DateTimePicker
        value={fromHHMM(value)}
        mode="time"
        display="compact"
        minuteInterval={15}
        timeZoneName="UTC"
        themeVariant="dark"
        accentColor={colors.accent}
        onValueChange={(_e, date) => onChange(toHHMM(date))}
        accessibilityLabel={`${day} ${label === "From" ? "opens" : "closes"}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget + space.sm, paddingHorizontal: space.md },
  times: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.md, paddingBottom: space.sm },
  time: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1 },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
});
