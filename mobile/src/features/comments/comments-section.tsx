import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authorHandle, authorLabel } from "@/features/people/author";
import { authorSpoken } from "@/features/people/author-line";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { api, errorText } from "@/api";
import type { CommentView, VenuePageResponse } from "@/api/contracts";
import { invalidateVenue } from "@/api/queries";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { a11yActions, showActions, useContentActions, type ContentAction } from "@/features/moderation/content-actions";
import { useFlaggedIds } from "@/features/moderation/flagged-store";
import { formatAge } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { colors, hairlineWidth, maxFontSizeMultiplier, radius, size, space, type as typeScale } from "@/theme";

export const COMMENT_MAX = 500;

type Mode = { kind: "new" } | { kind: "edit"; id: string; original: string } | { kind: "reply"; id: string; to: string };

type Props = { page: VenuePageResponse; signedIn: boolean };

export function CommentsSection({ page, signedIn }: Props) {
  const queryClient = useQueryClient();
  const venueId = page.official.id;
  const owner = page.viewer.ownsVenue;
  const buildActions = useContentActions();
  const flagged = useFlaggedIds();
  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<Mode>({ kind: "new" });
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: async (v: { mode: Mode; body: string }) => {
      if (v.mode.kind === "edit") return api.comments.edit(v.mode.id, v.body);
      if (v.mode.kind === "reply") return api.comments.reply(v.mode.id, v.body);
      return api.venues.comment(venueId, v.body);
    },
    onSuccess: (_r, v) => {
      haptics.success();
      toast.show(v.mode.kind === "edit" ? "Comment updated." : v.mode.kind === "reply" ? "Reply posted." : "Comment posted.");
      void invalidateVenue(queryClient, venueId);
    },
    onError: () => haptics.warning(),
  });

  const reset = () => {
    setMode({ kind: "new" });
    setBody("");
    send.reset();
  };

  const canSend = !!body.trim() && !send.isPending && !(mode.kind === "edit" && body.trim() === mode.original);

  const submit = () => {
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate({ mode, body: text }, { onSuccess: reset });
  };

  const startEdit = (c: CommentView) => {
    setMode({ kind: "edit", id: c.id, original: c.body });
    setBody(c.body);
    send.reset();
  };

  const startReply = (c: CommentView) => {
    setMode({ kind: "reply", id: c.id, to: c.author.kind === "user" ? `@${c.author.handle}` : "this comment" });
    setBody("");
    send.reset();
  };

  // Entering edit or reply mode focuses the composer.
  useEffect(() => {
    if (mode.kind !== "new") requestAnimationFrame(() => inputRef.current?.focus());
  }, [mode]);

  const commentActions = (c: CommentView): ContentAction[] => {
    const extra: ContentAction[] = [];
    // A comment with a venue reply is frozen (the API answers 409), so don't offer Edit.
    if (c.mine && c.replies.length === 0) extra.push({ label: "Edit", onPress: () => startEdit(c) });
    if (owner && !c.mine) extra.push({ label: `Reply as ${page.official.name}`, onPress: () => startReply(c) });
    return buildActions({ targetType: "COMMENT", id: c.id, author: c.author, mine: c.mine, extra });
  };
  // Venue replies are from a venue account: Report only.
  const replyActions = (r: CommentView["replies"][number]) =>
    buildActions({ targetType: "COMMENT", id: r.id, author: r.author, mine: r.mine, noBlock: true });

  // Owners can't post top-level comments on their own venue (the API refuses); they reply instead.
  const showComposer = signedIn ? !owner || mode.kind !== "new" : true;
  const comments = page.live.comments
    .filter((c) => !flagged.has(c.id))
    .map((c) => ({ ...c, replies: c.replies.filter((r) => !flagged.has(r.id)) }));

  return (
    <Section title="Comments">
      {comments.length === 0 ? (
        <Text variant="callout" color="textSecondary">
          No comments yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {comments.map((c, i) => (
            <View key={c.id}>
              {i > 0 && <View style={styles.separator} />}
              <CommentRow
                comment={c}
                now={page.now}
                venueName={page.official.name}
                actions={commentActions(c)}
                replyActions={replyActions}
                onReply={owner && !c.mine ? () => startReply(c) : undefined}
              />
            </View>
          ))}
        </View>
      )}

      {showComposer &&
        (signedIn ? (
          <View style={styles.composer}>
            {mode.kind !== "new" && (
              <View style={styles.modeRow}>
                <Text variant="footnote" color="textSecondary" style={styles.flex}>
                  {mode.kind === "edit" ? "Editing your comment" : `Replying to ${mode.to} as ${page.official.name}`}
                </Text>
                <Button title="Cancel" variant="plain" compact block={false} onPress={reset} />
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={body}
                onChangeText={setBody}
                placeholder={mode.kind === "reply" ? "Write a reply" : "Add a comment"}
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.accent}
                keyboardAppearance="dark"
                multiline
                maxLength={COMMENT_MAX}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                accessibilityLabel={mode.kind === "reply" ? "Reply" : "Comment"}
                style={styles.input}
              />
              <Pressable
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={mode.kind === "edit" ? "Save" : "Post"}
                accessibilityState={{ disabled: !canSend, busy: send.isPending }}
                style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.sendPressed]}
              >
                <Icon name={mode.kind === "edit" ? "checkmark" : "arrow.up"} color={canSend ? "onAccent" : "textTertiary"} size={size.iconSmall} weight="bold" />
              </Pressable>
            </View>
            {body.length > COMMENT_MAX - 50 && (
              <Text variant="caption" color="textTertiary" tabular>
                {COMMENT_MAX - body.length} characters left
              </Text>
            )}
            {send.error && <InlineError message={errorText(send.error, "Couldn't post that. Try again.")} />}
          </View>
        ) : (
          <Button title="Sign in to comment" variant="secondary" onPress={() => router.push("/sign-in")} />
        ))}
    </Section>
  );
}

type RowProps = {
  comment: CommentView;
  now: string;
  venueName: string;
  actions: ContentAction[];
  replyActions: (r: CommentView["replies"][number]) => ContentAction[];
  /** Owners of this venue get a visible Reply button. */
  onReply?: () => void;
};

function CommentRow({ comment: c, now, venueName, actions, replyActions, onReply }: RowProps) {
  const who = authorLabel(c.author);
  const handle = authorHandle(c.author);
  const age = `${formatAge(c.createdAt, now)}${c.editedAt ? ", edited" : ""}`;
  const openProfile = () => handle && router.push({ pathname: "/user/[handle]", params: { handle, modal: "1" } });
  const withProfile: ContentAction[] = handle ? [{ label: `View ${who}`, onPress: openProfile }, ...actions] : actions;
  return (
    <View style={styles.comment}>
      <View style={styles.header}>
        {/* One element for VoiceOver: who, when, what; the actions live in the rotor. */}
        <Pressable
          onPress={openProfile}
          disabled={!handle}
          accessible
          accessibilityLabel={`${authorSpoken(c.author)}, ${age}: ${c.body}`}
          accessibilityHint={handle ? "Opens their profile" : undefined}
          {...a11yActions(withProfile)}
          style={styles.body}
        >
          <View style={styles.meta}>
            <Text variant="subhead" weight="semibold" color={handle ? "textPrimary" : "textTertiary"} style={styles.shrink} numberOfLines={1}>
              {who}
            </Text>
            {c.author.kind === "user" && c.author.verified && <VerifiedBadge accessible={false} />}
            {c.author.kind === "user" && c.author.regular && <Badge label="Regular" />}
            <Text variant="footnote" color="textTertiary" style={styles.flex}>
              {formatAge(c.createdAt, now)}
              {c.editedAt ? " · edited" : ""}
            </Text>
          </View>
          <Text variant="body">{c.body}</Text>
        </Pressable>
        {actions.length > 0 && <MenuButton onPress={() => showActions(actions)} label={`More options for ${who}'s comment`} />}
      </View>

      {c.replies.map((r) => {
        const ra = replyActions(r);
        return (
          <View key={r.id} style={styles.reply}>
            <View style={styles.header}>
              <View style={styles.body} accessible accessibilityLabel={`Reply from ${venueName}, ${formatAge(r.createdAt, now)}: ${r.body}`} {...a11yActions(ra)}>
                <View style={styles.meta}>
                  <Text variant="subhead" weight="semibold" style={styles.shrink} numberOfLines={1}>
                    {venueName}
                  </Text>
                  <Badge label="Venue" />
                  <Text variant="footnote" color="textTertiary" style={styles.flex}>
                    {formatAge(r.createdAt, now)}
                  </Text>
                </View>
                <Text variant="body">{r.body}</Text>
              </View>
              {ra.length > 0 && <MenuButton onPress={() => showActions(ra)} label={`More options for ${venueName}'s reply`} />}
            </View>
          </View>
        );
      })}

      {onReply && (
        <Button title="Reply" icon="arrowshape.turn.up.left.fill" variant="plain" compact block={false} onPress={onReply} accessibilityLabel={`Reply to ${who} as ${venueName}`} />
      )}
    </View>
  );
}

function MenuButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.menu}>
      <Icon name="ellipsis" color="textTertiary" size={size.iconSmall} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.card, backgroundColor: colors.elevated, overflow: "hidden" },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
  comment: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xxs },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
  body: { flex: 1, gap: space.xxs, minHeight: size.hitTarget, justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  menu: { width: size.hitTarget, height: size.hitTarget, alignItems: "flex-end", justifyContent: "center", marginRight: -space.xs },
  reply: { marginTop: space.xs, marginLeft: space.xs, paddingLeft: space.sm, borderLeftWidth: size.threadLine, borderLeftColor: colors.hairline },
  composer: { gap: space.xs },
  modeRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  input: {
    flex: 1,
    ...typeScale.body,
    color: colors.textPrimary,
    minHeight: size.hitTarget,
    maxHeight: size.composerMaxHeight,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderRadius: radius.largeCard,
    backgroundColor: colors.elevated,
  },
  send: { width: size.hitTarget, height: size.hitTarget, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: colors.elevated },
  sendPressed: { backgroundColor: colors.accentPressed },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
});
