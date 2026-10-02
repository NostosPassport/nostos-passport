import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authorLabel } from "@/features/people/author";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { api, errorText, mediaUrl } from "@/api";
import { OfficialPhotoResponse, type OwnerDashboardResponse, type PromoView } from "@/api/contracts";
import { invalidateVenue, qk, useOwnerDashboard } from "@/api/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { chooseReportReason, OWNER_REPORT_REASONS, useFlag } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { HeaderButton } from "@/components/ui/header-button";
import { pickFromLibrary } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { accuracyCopy } from "@/features/venue/official-section";
import { DAY_NAMES, formatAge, formatCents, formatClock, LINE_LABEL, VIBE_LABEL, WEEK_ORDER } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { formatNy } from "@/lib/ny-time";
import { colors, maxFontSizeMultiplier, radius, screenPadding, size, space, type as typeScale } from "@/theme";

type Report = OwnerDashboardResponse["recentReports"][number];

export type PromoStatus = "scheduled" | "live" | "ended" | "cancelled";

/** Status from the server's times. The API cancels a future promo by collapsing it to a 1 ms window. */
export function promoStatus(p: Pick<PromoView, "startsAt" | "endsAt">, now: string): PromoStatus {
  const start = Date.parse(p.startsAt);
  const end = Date.parse(p.endsAt);
  const t = Date.parse(now);
  if (end - start <= 1000) return "cancelled";
  if (end <= t) return "ended";
  if (start > t) return "scheduled";
  return "live";
}

const STATUS_LABEL: Record<PromoStatus, string> = { scheduled: "Scheduled", live: "Live now", ended: "Ended", cancelled: "Cancelled" };

function reportText(r: Report): string {
  if (r.type === "VIBE" && r.vibe) return `Vibe: ${VIBE_LABEL[r.vibe]}`;
  if (r.type === "LINE" && r.line) return `Line: ${r.line === "NONE" ? "No line" : LINE_LABEL[r.line]}`;
  if (r.type === "COVER" && r.coverCents !== null) return `Cover: ${formatCents(r.coverCents)}`;
  return r.type;
}

/**
 * Owner dashboard: official info, promos, accuracy, anonymous recent reports (Flag), and comments
 * to reply to. Owners can't edit, hide or post user content; they reply and flag (API enforces).
 */
export default function OwnerDashboard() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const queryClient = useQueryClient();
  const dash = useOwnerDashboard(venueId);
  const flag = useFlag();
  const flagged = useFlaggedIds();
  const [refreshing, setRefreshing] = useState(false);
  const d = dash.data;

  const refresh = async () => {
    setRefreshing(true);
    await dash.refetch().finally(() => setRefreshing(false));
  };

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: qk.ownerDashboard(venueId) });
    void invalidateVenue(queryClient, venueId);
  };

  const endPromo = useMutation({
    mutationFn: (promoId: string) => api.owner.endPromo(promoId),
    onSuccess: () => {
      haptics.success();
      toast.show("Promo ended.");
      reload();
    },
    onError: (e) => toast.show(errorText(e, "Couldn't end that promo."), "neutral"),
  });

  const photo = useMutation({
    mutationFn: async (uri: string) => {
      const prepared = await prepareImage(uri);
      const form = new FormData();
      form.append("photo", { uri: prepared.uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
      return api.upload(`/api/owner/venues/${encodeURIComponent(venueId)}/photo`, OfficialPhotoResponse, form);
    },
    onSuccess: () => {
      haptics.success();
      toast.show("Photo updated.");
      reload();
    },
    onError: () => haptics.warning(),
  });

  // Pick first, then upload: the row only shows progress once there's a photo to send.
  const changePhoto = async () => {
    if (photo.isPending) return;
    const picked = await pickFromLibrary();
    if (picked) photo.mutate(picked.uri);
  };

  const confirmEnd = (p: PromoView, status: PromoStatus) =>
    status === "scheduled"
      ? Alert.alert(`Cancel \u201C${p.title}\u201D?`, "It won\u2019t run.", [
          { text: "Keep it", style: "cancel" },
          { text: "Cancel promo", style: "destructive", onPress: () => endPromo.mutate(p.id) },
        ])
      : Alert.alert(`End \u201C${p.title}\u201D?`, "It stops showing on your venue page right away.", [
          { text: "Keep it", style: "cancel" },
          { text: "End promo", style: "destructive", onPress: () => endPromo.mutate(p.id) },
        ]);

  const now = d?.page.now ?? new Date().toISOString();
  const unanswered = d?.page.live.comments.filter((c) => c.replies.length === 0) ?? [];
  const week = d ? d.venue.hours : [];
  const accuracy = d ? accuracyCopy(d.accuracy) : null;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: d?.venue.name ?? "Manage venue",
          headerRight: d ? () => <HeaderButton label="View page" onPress={() => router.push({ pathname: "/venue/[id]", params: { id: d.venue.id } })} /> : undefined,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {!d ? (
          dash.isError ? (
            <InlineError message={errorText(dash.error, "Couldn't load your venue.")} onRetry={() => void dash.refetch()} retrying={dash.isFetching} />
          ) : (
            <SkeletonRows count={6} />
          )
        ) : (
          <>
            <ListGroup header="Official info" footer="People see these as coming from the venue.">
              <ListRow
                icon="photo"
                title="Official photo"
                subtitle={d.venue.officialPhotoUrl ? "Shown at the top of your page" : "None yet"}
                trailing={
                  photo.isPending ? (
                    <ActivityIndicator color={colors.textSecondary} accessibilityLabel="Uploading photo" />
                  ) : d.venue.officialPhotoUrl ? (
                    <Image source={{ uri: mediaUrl(d.venue.officialPhotoUrl) }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
                  ) : undefined
                }
                onPress={() => void changePhoto()}
                accessibilityHint="Choose a new photo from your library"
              />
              <ListRow
                icon="clock"
                title="Hours"
                subtitle={
                  week.length
                    ? WEEK_ORDER.filter((i) => week.some((h) => h.day === i))
                        .map((i) => {
                          const h = week.find((x) => x.day === i)!;
                          return `${DAY_NAMES[i].slice(0, 3)} ${formatClock(h.open)}\u2013${formatClock(h.close)}`;
                        })
                        .join("\n")
                    : "Not posted"
                }
                chevron
                onPress={() => router.push({ pathname: "/owner/hours", params: { venueId } })}
              />
              <ListRow
                icon="pencil"
                title="Name, address, cover, dress code"
                subtitle={`${d.venue.officialCoverCents === null ? "No official cover" : `Cover ${formatCents(d.venue.officialCoverCents)}`}${d.venue.dressCode ? ` · ${d.venue.dressCode}` : ""}`}
                chevron
                onPress={() => router.push({ pathname: "/owner/edit", params: { venueId } })}
              />
            </ListGroup>
            {photo.error && <InlineError message={errorText(photo.error, "Couldn't update the photo.")} />}

            <ListGroup header="Promos" footer="Paid promos are labelled Promoted. Promos never change where you appear in lists.">
              {d.promos.length === 0 ? (
                <ListRow title="No promos" subtitle="Tell people about a special tonight." />
              ) : (
                d.promos.map((p) => {
                  const status = promoStatus(p, now);
                  const active = status === "live" || status === "scheduled";
                  return (
                    <ListRow
                      key={p.id}
                      title={p.title}
                      subtitle={`${STATUS_LABEL[status]}${status === "cancelled" ? "" : ` \u00B7 ${formatNy(p.startsAt)} \u2013 ${formatNy(p.endsAt)}`}`}
                      trailing={
                        <View style={styles.promoTrail}>
                          {p.isPaid && <Badge label="Promoted" />}
                          {active && (
                            <Button
                              title={status === "scheduled" ? "Cancel" : "End"}
                              variant="plain"
                              compact
                              block={false}
                              onPress={() => confirmEnd(p, status)}
                              accessibilityLabel={`${status === "scheduled" ? "Cancel" : "End"} ${p.title}`}
                            />
                          )}
                        </View>
                      }
                    />
                  );
                })
              )}
              <ListRow icon="plus.circle.fill" iconColor="accent" title="New promo" titleColor="accent" onPress={() => router.push({ pathname: "/owner/promo", params: { venueId } })} />
            </ListGroup>

            {accuracy && (
              <ListGroup header="Cover accuracy" footer="Computed from what people report. You can't edit it.">
                <ListRow icon="checkmark.seal" title={accuracy.title} subtitle={accuracy.detail} />
              </ListGroup>
            )}

            <ListGroup header="Recent reports" footer="Reports are anonymous. Flag one if it looks wrong; moderators review it.">
              {d.recentReports.length === 0 ? (
                <ListRow title="No reports in the last few hours" />
              ) : (
                d.recentReports.map((r) => (
                  <ListRow
                    key={r.id}
                    title={reportText(r)}
                    subtitle={formatAge(r.createdAt, now)}
                    trailing={
                      flagged.has(r.id) ? (
                        <Text variant="subhead" color="textTertiary">
                          Flagged
                        </Text>
                      ) : (
                        <Button
                          title="Flag"
                          variant="plain"
                          compact
                          block={false}
                          onPress={() =>
                            chooseReportReason(
                              "Flag this report",
                              (reason) => flag.mutate({ targetType: "REPORT", targetId: r.id, reason }),
                              OWNER_REPORT_REASONS,
                              "Moderators check it against other reports. Reports stay anonymous.",
                            )
                          }
                          accessibilityLabel={`Flag report: ${reportText(r)}`}
                        />
                      )
                    }
                  />
                ))
              )}
            </ListGroup>

            <View style={styles.block}>
              <Text variant="footnote" color="textSecondary" weight="semibold" style={styles.groupHeader} accessibilityRole="header">
                Comments waiting for a reply
              </Text>
              {unanswered.length === 0 ? (
                <View style={styles.card}>
                  <Text variant="body" color="textSecondary">
                    You&apos;re all caught up.
                  </Text>
                </View>
              ) : (
                unanswered.map((c) => <ReplyCard key={c.id} venueId={venueId} comment={c} now={now} onDone={reload} />)
              )}
            </View>

            {d.hiddenReplies.length > 0 && (
              <ListGroup header="Hidden replies" footer="Moderators hid these replies. Contact support if you think that's wrong.">
                {d.hiddenReplies.map((r) => (
                  <ListRow key={r.id} title={r.body} subtitle={r.hiddenAt ? `Hidden ${formatAge(r.hiddenAt, now)}` : "Hidden"} />
                ))}
              </ListGroup>
            )}
          </>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

type Comment = OwnerDashboardResponse["page"]["live"]["comments"][number];

function ReplyCard({ venueId, comment, now, onDone }: { venueId: string; comment: Comment; now: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const reply = useMutation({
    mutationFn: () => api.comments.reply(comment.id, body.trim()),
    onSuccess: () => {
      haptics.success();
      toast.show("Reply posted.");
      setBody("");
      onDone();
    },
    onError: () => haptics.warning(),
  });
  const who = authorLabel(comment.author);
  return (
    <View style={styles.card}>
      <Text variant="subhead" weight="semibold" accessibilityLabel={`${who}, ${formatAge(comment.createdAt, now)}: ${comment.body}`}>
        {who}{" "}
        <Text variant="footnote" color="textTertiary">
          {formatAge(comment.createdAt, now)}
        </Text>
      </Text>
      <Text variant="body">{comment.body}</Text>
      <View style={styles.replyRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Reply as the venue"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          multiline
          maxLength={500}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          accessibilityLabel={`Reply to ${who}`}
          style={styles.replyInput}
        />
        <Button title="Reply" compact block={false} disabled={!body.trim()} loading={reply.isPending} onPress={() => reply.mutate()} />
      </View>
      {reply.error && <InlineError message={errorText(reply.error, "Couldn't post that reply.")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.xl },
  thumb: { width: size.avatar, height: size.avatar, borderRadius: radius.chip },
  promoTrail: { flexDirection: "row", alignItems: "center", gap: space.xs },
  block: { gap: space.xs },
  groupHeader: { paddingHorizontal: space.md },
  card: { gap: space.xs, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  replyRow: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  replyInput: {
    flex: 1,
    ...typeScale.body,
    color: colors.textPrimary,
    minHeight: size.hitTarget,
    maxHeight: size.composerMaxHeight,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.button,
    backgroundColor: colors.elevated,
  },
});
