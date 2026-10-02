import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { api, errorText, mediaUrl } from "@/api";
import type { TargetType, ModQueueItem } from "@/api/contracts";
import { useModHidden, useModLog, useModQueue } from "@/api/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { actionWord, reputationText } from "@/features/moderation/format";
import { formatAge, plural } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { colors, hairlineWidth, radius, screenPadding, size, space } from "@/theme";

type Tab = "queue" | "hidden" | "log";
type Target = { targetType: TargetType; targetId: string; author: string; venue: string | null; autoHidden?: boolean };
type Action = "HIDE" | "DISMISS" | "RESTORE" | "SUSPEND" | "UNSUSPEND";

const NOUN: Record<TargetType, string> = { STAMP: "Stamp", USER: "Account" };
/** The log keeps the database's names, including content types older entries may carry. */
const LOG_NOUN: Record<string, string> = { PHOTO: "Stamp", COMMENT: "Comment", REPORT: "Report", USER: "Account" };
const VERB: Record<Action, { title: string; done: string; destructive: boolean }> = {
  HIDE: { title: "Hide", done: "Hidden.", destructive: true },
  DISMISS: { title: "Dismiss flags", done: "Flags dismissed.", destructive: false },
  RESTORE: { title: "Restore", done: "Restored.", destructive: false },
  SUSPEND: { title: "Suspend account", done: "Account suspended.", destructive: true },
  UNSUSPEND: { title: "Unsuspend", done: "Account unsuspended.", destructive: false },
};

/** Moderators: the flag queue grouped by item, hidden content to restore, and the log. */
export default function Moderation() {
  const [tab, setTab] = useState<Tab>("queue");
  const queue = useModQueue();
  const hidden = useModHidden(tab === "hidden");
  const log = useModLog(tab === "log");
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const act = useMutation({
    mutationFn: (v: { targetType: TargetType; targetId: string; action: Action; note?: string }) => api.mod.act(v),
    onSuccess: (_r, v) => {
      haptics.success();
      toast.show(VERB[v.action].done);
      for (const key of [["mod"], ["feed"], ["user"], ["stamp"]]) void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => {
      haptics.warning();
      toast.show(errorText(e, "Couldn't do that. Try again."), "neutral");
    },
  });

  /** Confirm, naming the item, with an optional note (kept in the moderation log). */
  const confirm = (t: Target, action: Action) => {
    const v = VERB[action];
    const what = t.targetType === "USER" ? t.author : `${NOUN[t.targetType].toLowerCase()} by ${t.author}${t.venue ? ` at ${t.venue}` : ""}`;
    const effect = action === "DISMISS" && t.autoHidden ? " It will be visible again." : "";
    const { targetType, targetId } = t;
    Alert.prompt(
      `${v.title}: ${what}?`,
      `Add a note for the log (optional).${effect}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: v.title, style: v.destructive ? "destructive" : "default", onPress: (note?: string) => act.mutate({ targetType, targetId, action, note: note?.trim() || undefined }) },
      ],
      "plain-text",
      "",
      "default",
    );
  };

  const refresh = async () => {
    setRefreshing(true);
    const q = tab === "queue" ? queue : tab === "hidden" ? hidden : log;
    await q.refetch().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        <SegmentedControl
          segments={[
            { key: "queue", label: queue.data ? `Queue (${queue.data.items.length})` : "Queue" },
            { key: "hidden", label: "Hidden" },
            { key: "log", label: "Log" },
          ]}
          value={tab}
          onChange={setTab}
          accessibilityLabel="Moderation sections"
        />

        {tab === "queue" &&
          (queue.isPending ? (
            <SkeletonRows count={4} />
          ) : queue.isError ? (
            <InlineError message={errorText(queue.error, "Couldn't load the queue.")} onRetry={() => void queue.refetch()} retrying={queue.isFetching} />
          ) : queue.data.items.length === 0 ? (
            <Text variant="callout" color="textSecondary">
              Nothing to review. The queue is clear.
            </Text>
          ) : (
            queue.data.items.map((item) => (
              <QueueCard
                key={`${item.targetType}:${item.targetId}`}
                item={item}
                busy={act.isPending && act.variables?.targetId === item.targetId}
                onAct={(a) =>
                  confirm(
                    {
                      targetType: item.targetType,
                      targetId: item.targetId,
                      author: item.content?.author ?? "unknown",
                      venue: item.venue?.name ?? null,
                      autoHidden: !!item.content?.hiddenAt && item.history.some((h) => h.action === "AUTO_HIDE"),
                    },
                    a,
                  )
                }
              />
            ))
          ))}

        {tab === "hidden" &&
          (hidden.isPending ? (
            <SkeletonRows count={4} />
          ) : hidden.isError ? (
            <InlineError message={errorText(hidden.error, "Couldn't load hidden items.")} onRetry={() => void hidden.refetch()} retrying={hidden.isFetching} />
          ) : hidden.data.items.length === 0 ? (
            <Text variant="callout" color="textSecondary">
              Nothing is hidden or suspended.
            </Text>
          ) : (
            <ListGroup>
              {hidden.data.items.map((h) => (
                <ListRow
                  key={`${h.targetType}:${h.targetId}`}
                  leading={h.url ? <Image source={{ uri: mediaUrl(h.url) }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Hidden photo by ${h.author}`} /> : undefined}
                  title={h.preview || NOUN[h.targetType]}
                  subtitle={`${NOUN[h.targetType]} by ${h.author}${h.venue ? ` at ${h.venue.name}` : ""} · ${formatAge(h.hiddenAt)}`}
                  trailing={
                    <Button
                      title={h.targetType === "USER" ? "Unsuspend" : "Restore"}
                      variant="plain"
                      compact
                      block={false}
                      onPress={() => confirm({ targetType: h.targetType, targetId: h.targetId, author: h.author, venue: h.venue?.name ?? null }, h.targetType === "USER" ? "UNSUSPEND" : "RESTORE")}
                      accessibilityLabel={`${h.targetType === "USER" ? "Unsuspend" : "Restore"} ${NOUN[h.targetType].toLowerCase()} by ${h.author}`}
                    />
                  }
                />
              ))}
            </ListGroup>
          ))}

        {tab === "log" &&
          (log.isPending ? (
            <SkeletonRows count={6} />
          ) : log.isError ? (
            <InlineError message={errorText(log.error, "Couldn't load the log.")} onRetry={() => void log.refetch()} retrying={log.isFetching} />
          ) : log.data.events.length === 0 ? (
            <Text variant="callout" color="textSecondary">
              No moderation actions yet.
            </Text>
          ) : (
            <ListGroup footer="The log is permanent: entries are never edited or removed.">
              {log.data.events.map((e) => (
                <ListRow
                  key={e.id}
                  title={`${actionWord(e.action)} \u00B7 ${LOG_NOUN[e.targetType] ?? e.targetType}`}
                  subtitle={`${e.by} \u00B7 ${formatAge(e.createdAt)}${e.note ? ` \u00B7 \u201C${e.note}\u201D` : ""}`}
                />
              ))}
            </ListGroup>
          ))}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

function QueueCard({ item, busy, onAct }: { item: ModQueueItem; busy: boolean; onAct: (a: Action) => void }) {
  const c = item.content;
  const isUser = item.targetType === "USER";
  const hidden = !!c?.hiddenAt;
  // Flags are listed above; the history shows only what moderators (or auto-hide) did.
  const history = item.history.filter((h) => h.action !== "FLAGGED");
  const who = `${NOUN[item.targetType].toLowerCase()} by ${c?.author ?? "unknown"}`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Badge label={NOUN[item.targetType]} />
        <Text variant="footnote" color="textSecondary" style={styles.flex} numberOfLines={1}>
          {item.venue ? item.venue.name : "Account report"} · {plural(item.flags.length, "flag")}
        </Text>
        {c?.hiddenAt && <Badge label={isUser ? "Suspended" : "Hidden"} />}
      </View>

      {c ? (
        <View style={styles.preview}>
          {c.url && <Image source={{ uri: mediaUrl(c.url) }} style={styles.photo} contentFit="cover" accessibilityLabel="Flagged stamp" />}
          {!!c.preview && <Text variant="body">{c.preview}</Text>}
          <Text variant="footnote" color="textTertiary">
            {c.author} · {reputationText(c.authorRep)} · {formatAge(c.createdAt)}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" color="textTertiary">
          The content is no longer available.
        </Text>
      )}

      <View style={styles.flags}>
        {item.flags.map((f) => (
          <View key={f.id} style={styles.flag}>
            <Text variant="subhead">&ldquo;{f.reason}&rdquo;</Text>
            <Text variant="footnote" color="textTertiary">
              {f.by}
              {f.byRole !== "USER" ? ` · ${f.byRole.toLowerCase()}` : ""} · {formatAge(f.createdAt)}
            </Text>
          </View>
        ))}
      </View>

      {history.length > 0 && (
        <View style={styles.flag}>
          {history.map((h, i) => (
            <Text key={i} variant="footnote" color="textTertiary">
              {actionWord(h.action)} by {h.by} · {formatAge(h.at)}
              {h.note ? ` \u00B7 \u201C${h.note}\u201D` : ""}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {isUser ? (
          hidden ? (
            <Button title="Unsuspend" variant="secondary" compact block={false} disabled={busy} onPress={() => onAct("UNSUSPEND")} accessibilityLabel={`Unsuspend ${c?.author}`} />
          ) : (
            <Button title="Suspend" variant="destructive" compact block={false} disabled={busy} onPress={() => onAct("SUSPEND")} accessibilityLabel={`Suspend ${c?.author}`} />
          )
        ) : (
          <Button title={hidden ? "Keep hidden" : "Hide"} variant="destructive" compact block={false} disabled={busy} onPress={() => onAct("HIDE")} accessibilityLabel={`${hidden ? "Keep hidden" : "Hide"} ${who}`} />
        )}
        <Button title="Dismiss" variant="secondary" compact block={false} disabled={busy} onPress={() => onAct("DISMISS")} accessibilityLabel={`Dismiss flags on ${who}`} />
        {!isUser && hidden && <Button title="Restore" variant="plain" compact block={false} disabled={busy} onPress={() => onAct("RESTORE")} accessibilityLabel={`Restore ${who}`} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.md },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.xs },
  preview: { gap: space.xs },
  photo: { height: size.heroHeight, borderRadius: radius.chip, backgroundColor: colors.elevated },
  flags: { gap: space.xs, paddingTop: space.xs, borderTopWidth: hairlineWidth, borderTopColor: colors.hairline },
  flag: { gap: space.xxs },
  actions: { flexDirection: "row", gap: space.xs, flexWrap: "wrap" },
  thumb: { width: size.avatar, height: size.avatar, borderRadius: radius.chip },
  flex: { flex: 1 },
});
