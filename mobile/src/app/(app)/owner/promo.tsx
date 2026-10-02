import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { api, errorText } from "@/api";
import { invalidateVenue, qk } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { nextQuarterHour, toNyLocal } from "@/lib/ny-time";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, hairlineWidth, radius, size, space } from "@/theme";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** API limits: starts at most 90 days out, runs at most 30 days. */
const MAX_START_DAYS = 90;
const MAX_LENGTH_DAYS = 30;

/** New promo. Starts and ends are sent as New York wall-clock times, whatever zone the phone is in. */
export default function NewPromo() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Rounded to the picker's 15-minute steps, so what's shown is what's sent.
  const [startsAt, setStartsAt] = useState(() => nextQuarterHour(new Date()));
  const [endsAt, setEndsAt] = useState(() => new Date(nextQuarterHour(new Date()).getTime() + 4 * HOUR));
  const [saved, setSaved] = useState(false);
  // "Now" for limits, fixed when the form opens (render must stay pure).
  const [openedAt] = useState(() => Date.now());
  useConfirmDiscard(!saved && (title.trim().length > 0 || body.trim().length > 0));

  const create = useMutation({
    mutationFn: () => api.owner.createPromo(venueId, { title: title.trim(), body: body.trim(), startsAt: toNyLocal(startsAt), endsAt: toNyLocal(endsAt) }),
    onSuccess: () => {
      haptics.success();
      toast.show("Promo created.");
      void queryClient.invalidateQueries({ queryKey: qk.ownerDashboard(venueId) });
      void invalidateVenue(queryClient, venueId);
    },
    onError: () => haptics.warning(),
  });

  const problem =
    endsAt <= startsAt
      ? "The end has to be after the start."
      : endsAt.getTime() - startsAt.getTime() > MAX_LENGTH_DAYS * DAY
        ? `A promo can run up to ${MAX_LENGTH_DAYS} days.`
        : endsAt.getTime() <= openedAt
          ? "The end has to be in the future."
          : null;
  const tooShort = (title.trim().length > 0 && title.trim().length < 3) || (body.trim().length > 0 && body.trim().length < 3);
  const valid = title.trim().length >= 3 && body.trim().length >= 3 && !problem;
  const save = () =>
    valid &&
    !create.isPending &&
    create.mutate(undefined, {
      onSuccess: () => {
        setSaved(true);
        requestAnimationFrame(() => router.back());
      },
    });

  return (
    <FormScreen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Create" bold onPress={save} disabled={!valid || create.isPending} /> }} />
      <FieldGroup
        footer="Promos show on your venue page. An admin marks paid ones as Promoted."
        errors={[tooShort ? "Title and details need at least 3 characters each." : null]}
      >
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Half-price drafts" maxLength={80} />
        <Field label="Details" value={body} onChangeText={setBody} placeholder="Until midnight at the bar" multiline maxLength={400} />
      </FieldGroup>
      <View style={styles.group}>
        <When label="Starts" value={startsAt} onChange={setStartsAt} maximum={new Date(openedAt + MAX_START_DAYS * DAY)} />
        <View style={styles.separator} />
        <When label="Ends" value={endsAt} onChange={setEndsAt} minimum={startsAt} maximum={new Date(startsAt.getTime() + MAX_LENGTH_DAYS * DAY)} />
      </View>
      <Text variant="footnote" color="textTertiary">
        New York time. A promo can run up to 30 days and start up to 90 days out.
      </Text>
      {problem && (
        <Text variant="footnote" color="danger">
          {problem}
        </Text>
      )}
      {create.error && <InlineError message={errorText(create.error, "Couldn't create the promo. Check the dates and try again.")} />}
    </FormScreen>
  );
}

function When({ label, value, onChange, minimum, maximum }: { label: string; value: Date; onChange: (d: Date) => void; minimum?: Date; maximum?: Date }) {
  return (
    <View style={styles.row}>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <DateTimePicker
        value={value}
        mode="datetime"
        display="compact"
        minuteInterval={15}
        minimumDate={minimum}
        maximumDate={maximum}
        // Show New York wall-clock time even if the phone is elsewhere.
        timeZoneName="America/New_York"
        themeVariant="dark"
        accentColor={colors.accent}
        onValueChange={(_e, d) => onChange(d)}
        accessibilityLabel={`${label} date and time`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: size.hitTarget + space.sm, paddingHorizontal: space.md },
  label: { width: size.fieldLabel },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
});
