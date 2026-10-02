import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { errorText } from "@/api";
import { useOwnerDashboard } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { changedFields, useUpdateInfo, type DetailValues } from "@/features/owner/use-update-info";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";

function coverToInput(cents: number | null): string {
  if (cents === null) return "";
  if (cents === 0) return "free";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Name, address, official cover and dress code. Sends only what changed. */
export default function EditDetails() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const dash = useOwnerDashboard(venueId);
  const v = dash.data?.venue;
  if (!v)
    return (
      <FormScreen>
        {dash.isError ? (
          <InlineError message={errorText(dash.error, "Couldn't load your venue.")} onRetry={() => void dash.refetch()} retrying={dash.isFetching} />
        ) : (
          <SkeletonRows count={4} />
        )}
      </FormScreen>
    );
  return <EditForm venueId={venueId} initial={{ name: v.name, address: v.address, officialCover: coverToInput(v.officialCoverCents), dressCode: v.dressCode ?? "" }} />;
}

type Values = DetailValues;

function EditForm({ venueId, initial }: { venueId: string; initial: Values }) {
  const [values, setValues] = useState(initial);
  const update = useUpdateInfo(venueId);
  const set = (k: keyof Values) => (t: string) => setValues((v) => ({ ...v, [k]: t }));

  const changed = changedFields(initial, values);
  const dirty = Object.keys(changed).length > 0;
  const [saved, setSaved] = useState(false);
  useConfirmDiscard(dirty && !saved);

  const save = () =>
    dirty &&
    !update.isPending &&
    update.mutate(changed, {
      onSuccess: () => {
        setSaved(true);
        requestAnimationFrame(() => router.back());
      },
    });

  return (
    <FormScreen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Save" bold onPress={save} disabled={!dirty || update.isPending} /> }} />
      <FieldGroup>
        <Field label="Name" value={values.name} onChangeText={set("name")} autoCapitalize="words" returnKeyType="next" />
        <Field label="Address" value={values.address} onChangeText={set("address")} placeholder="Street address" autoCapitalize="words" textContentType="fullStreetAddress" />
      </FieldGroup>
      <FieldGroup footer={"Enter dollars (for example 15), \u201Cfree\u201D, or leave it empty if you don\u2019t post a cover."}>
        <Field label="Cover" value={values.officialCover} onChangeText={set("officialCover")} placeholder="Not posted" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        <Field label="Dress code" value={values.dressCode} onChangeText={set("dressCode")} placeholder="None" />
      </FieldGroup>
      {update.error && <InlineError message={errorText(update.error, "Couldn't save. Check the fields and try again.")} />}
    </FormScreen>
  );
}
