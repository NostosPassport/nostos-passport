import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { api, ApiError, errorText } from "@/api";
import { OFFLINE_MESSAGE } from "@/api/client";
import type { LineWait, ReportRequest, Vibe } from "@/api/contracts";
import { invalidateVenue } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { VibeDot } from "@/components/venue/vibe-dot";
import { locationStore } from "@/features/location/location-store";
import { cooldowns } from "@/features/venue/cooldowns";
import { requestPresencePing } from "@/features/venue/presence";
import { coverInputToApi, LINE_LABEL, VIBE_LABEL } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { colors, maxFontSizeMultiplier, radius, screenPadding, size, space, type as typeScale } from "@/theme";

type Kind = "VIBE" | "LINE" | "COVER";
type ReportChoice = { key: string } & ({ type: "VIBE"; vibe: Vibe } | { type: "LINE"; line: LineWait } | { type: "COVER"; cover: string });

const TITLES: Record<Kind, string> = { VIBE: "What's the vibe?", LINE: "How's the line?", COVER: "What's the cover?" };
const DONE: Record<Kind, string> = { VIBE: "Vibe posted. Thanks.", LINE: "Line posted. Thanks.", COVER: "Cover posted. Thanks." };
const VIBES: Vibe[] = ["PACKED", "BUSY", "CHILL", "DEAD"];
const LINES: LineWait[] = ["NONE", "UNDER_10", "TEN_TO_30", "OVER_30"];

/** Small native sheet with one-tap chips (cover gets a keypad). */
export default function ReportSheet() {
  const { id, kind: kindParam, name } = useLocalSearchParams<{ id: string; kind: Kind; name?: string }>();
  const kind: Kind = kindParam === "LINE" || kindParam === "COVER" ? kindParam : "VIBE";
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [cover, setCover] = useState("");
  const [noLocation, setNoLocation] = useState(false);

  const post = useMutation({
    mutationFn: async (body: ReportChoice) => {
      const coords = await locationStore.currentForPosting();
      if (!coords) throw new ApiError(0, "no_location", "We need your location to post.");
      const { key: _key, ...rest } = body;
      return api.venues.report(id, { ...rest, ...coords } as ReportRequest);
    },
    onMutate: (body) => {
      setPending(body.key);
      setNoLocation(false);
    },
    onSuccess: () => {
      haptics.success();
      cooldowns.clear(id, kind);
      toast.show(DONE[kind]);
      void invalidateVenue(queryClient, id);
    },
    onError: (e) => {
      haptics.warning();
      if (e instanceof ApiError && e.code === "no_location") setNoLocation(true);
      if (e instanceof ApiError && e.code === "rate_limited") cooldowns.set(id, kind, e.message);
      // Refused by the geofence: have the venue screen re-check where we are.
      if (e instanceof ApiError && e.status === 403) requestPresencePing(id);
    },
    onSettled: () => setPending(null),
  });

  const submit = (choice: ReportChoice) => {
    if (post.isPending) return;
    haptics.select();
    // Navigation lives on the call, not the hook: it won't fire if the sheet was already dismissed.
    post.mutate(choice, { onSuccess: () => router.back() });
  };

  const busy = post.isPending;
  const coverValue = coverInputToApi(cover);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="title2" accessibilityRole="header">
          {TITLES[kind]}
        </Text>
        {!!name && (
          <Text variant="subhead" color="textSecondary">
            {name}
          </Text>
        )}
      </View>

      {kind === "VIBE" && (
        <View style={styles.grid}>
          {VIBES.map((v) => (
            <Chip
              key={v}
              large
              label={VIBE_LABEL[v]}
              leading={<VibeDot vibe={v} dotSize={size.iconTiny} />}
              loading={pending === v}
              disabled={busy && pending !== v}
              onPress={() => submit({ type: "VIBE", vibe: v, key: v })}
              accessibilityLabel={`Post vibe: ${VIBE_LABEL[v]}`}
            />
          ))}
        </View>
      )}

      {kind === "LINE" && (
        <View style={styles.grid}>
          {LINES.map((l) => (
            <Chip
              key={l}
              large
              label={LINE_LABEL[l]}
              loading={pending === l}
              disabled={busy && pending !== l}
              onPress={() => submit({ type: "LINE", line: l, key: l })}
              accessibilityLabel={`Post line: ${LINE_LABEL[l]}`}
            />
          ))}
        </View>
      )}

      {kind === "COVER" && (
        <View style={styles.cover}>
          <View style={styles.amount}>
            <Text variant="largeTitle" color="textSecondary">
              $
            </Text>
            <TextInput
              value={cover}
              onChangeText={(t) => setCover(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 6))}
              keyboardType="decimal-pad"
              keyboardAppearance="dark"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              autoFocus
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              accessibilityLabel="Cover in dollars"
              style={styles.amountInput}
            />
          </View>
          <View style={styles.coverActions}>
            <Chip label="Free" loading={pending === "free"} disabled={busy && pending !== "free"} onPress={() => submit({ type: "COVER", cover: "free", key: "free" })} accessibilityLabel="Post cover: free" />
            <View style={styles.flex}>
              <Button
                title="Post cover"
                onPress={() => submit({ type: "COVER", cover: coverValue, key: "amount" })}
                disabled={!coverValue || (busy && pending !== "amount")}
                loading={pending === "amount"}
              />
            </View>
          </View>
        </View>
      )}

      {post.isPaused && <InlineError message={OFFLINE_MESSAGE} />}
      {post.error && !noLocation && <InlineError message={errorText(post.error, "Couldn't post that. Try again.")} />}
      {noLocation && (
        <View style={styles.noLocation}>
          <InlineError message="We need your location to confirm you're here." />
          <Button title="Share location" variant="secondary" onPress={() => router.push("/location-permission")} />
        </View>
      )}

      <Text variant="footnote" color="textTertiary">
        Reports are anonymous to the venue.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // fitToContents already pads for the home indicator.
  root: { backgroundColor: colors.surface, paddingHorizontal: screenPadding, paddingTop: space.xl, paddingBottom: space.md, gap: space.lg },
  header: { gap: space.xxs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cover: { gap: space.md },
  amount: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.elevated },
  amountInput: { flex: 1, ...typeScale.largeTitle, color: colors.textPrimary, paddingVertical: space.sm, fontVariant: ["tabular-nums"] },
  coverActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  noLocation: { gap: space.sm },
});
