/**
 * Report and Block for user content (Guideline 1.2): every photo, comment and profile can be
 * reported, and every author blocked. Native action sheets and alerts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActionSheetIOS, Alert } from "react-native";

import { api, ApiError, errorText } from "@/api";
import type { AuthorView, ContentType } from "@/api/contracts";
import { useAuth } from "@/auth/auth-context";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { colors } from "@/theme";
import { flaggedStore } from "./flagged-store";

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or hate",
  "Sexual or violent content",
  "Not about this venue",
  "Someone's private information",
] as const;

export function useFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { targetType: ContentType; targetId: string; reason: string }) => api.flags.create(v),
    onSuccess: (res, v) => {
      haptics.success();
      if (v.targetType !== "USER") flaggedStore.add(v.targetId);
      toast.show(res.autoHidden ? "Thanks. It's hidden while we review it." : "Thanks. We'll take a look.");
      void queryClient.invalidateQueries({ queryKey: ["venue"] });
      void queryClient.invalidateQueries({ queryKey: ["owner"] });
    },
    onError: (e, v) => {
      haptics.warning();
      // Already flagged (409): hide it for this person anyway. Limits (429) come with the server's sentence.
      if (e instanceof ApiError && e.status === 409 && v.targetType !== "USER") flaggedStore.add(v.targetId);
      toast.show(errorText(e, "Couldn't send that report. Try again."), "neutral");
    },
  });
}

/**
 * Block or unblock. By handle (profiles, known authors), by content (an "Anonymous" author: the server blocks
 * whoever wrote it and never says who), or by the block list's ref (unblock).
 */
export type BlockVars =
  | { handle: string; block: boolean }
  | { content: { targetType: "PHOTO" | "COMMENT"; targetId: string } }
  | { ref: string; label: string };

export function useBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: BlockVars) =>
      "content" in v ? api.blocks.authorOf(v.content) : "ref" in v ? api.me.unblock(v.ref) : api.users.block(v.handle, v.block),
    onSuccess: (_r, v) => {
      toast.show("content" in v ? "Blocked." : "ref" in v ? `Unblocked ${v.label}.` : v.block ? `Blocked @${v.handle}.` : `Unblocked @${v.handle}.`);
      // Blocking hides each other's content everywhere.
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.show(errorText(e, "Couldn't do that. Try again."), "neutral"),
  });
}

/** Reasons an owner flags an anonymous report on their venue. */
export const OWNER_REPORT_REASONS = ["Looks inaccurate", "We weren't open then", "Spam or abuse"] as const;

/** Ask for a reason, then flag. */
export function chooseReportReason(
  title: string,
  onPick: (reason: string) => void,
  reasons: readonly string[] = REPORT_REASONS,
  message = "Reports are reviewed by moderators. The person isn't told who reported them.",
) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      message,
      options: [...reasons, "Cancel"],
      cancelButtonIndex: reasons.length,
      tintColor: colors.accent,
      userInterfaceStyle: "dark",
    },
    (i) => {
      if (i < reasons.length) onPick(reasons[i]);
    },
  );
}

/** `handle` null = an Anonymous author: blocked by their content, and we never learn who it was. */
export function confirmBlock(handle: string | null, onConfirm: () => void) {
  Alert.alert(handle ? `Block @${handle}?` : "Block this person?", "You won't see each other's photos, comments or profile, and follows are removed. They aren't notified.", [
    { text: "Cancel", style: "cancel" },
    { text: "Block", style: "destructive", onPress: onConfirm },
  ]);
}

export type ContentMenuItem = {
  targetType: "PHOTO" | "COMMENT";
  id: string;
  author: AuthorView;
  mine: boolean;
  /** Venue replies: the author is a venue account, so offer Report only. */
  noBlock?: boolean;
  /** Extra actions shown first (Edit, Reply as venue). */
  extra?: { label: string; onPress: () => void }[];
};

export type ContentAction = { label: string; destructive?: boolean; onPress: () => void };

/** The actions for a photo or comment: extras (Edit, Reply) first, then Report and Block for others' content. */
export function useContentActions(): (item: ContentMenuItem) => ContentAction[] {
  const { status } = useAuth();
  const flag = useFlag();
  const block = useBlock();

  return (item) => {
    const noun = item.targetType === "PHOTO" ? "photo" : "comment";
    const actions: ContentAction[] = [...(item.extra ?? [])];
    if (!item.mine) {
      actions.push({
        label: `Report ${noun}`,
        destructive: true,
        onPress: () => {
          if (status !== "signedIn") return router.push("/sign-in");
          chooseReportReason(`Report this ${noun}`, (reason) => flag.mutate({ targetType: item.targetType, targetId: item.id, reason }));
        },
      });
      if (item.author.kind === "user" && !item.noBlock) {
        const handle = item.author.handle;
        actions.push({
          label: `Block @${handle}`,
          destructive: true,
          onPress: () => {
            if (status !== "signedIn") return router.push("/sign-in");
            confirmBlock(handle, () => block.mutate({ handle, block: true }));
          },
        });
      } else if (item.author.kind === "anonymous" && !item.noBlock) {
        // Guideline 1.2: every author can be blocked, including the ones you can't see.
        actions.push({
          label: "Block this person",
          destructive: true,
          onPress: () => {
            if (status !== "signedIn") return router.push("/sign-in");
            confirmBlock(null, () => block.mutate({ content: { targetType: item.targetType, targetId: item.id } }));
          },
        });
      }
    }
    return actions;
  };
}

/** Native action sheet for a list of actions. */
export function showActions(actions: ContentAction[]): void {
  if (actions.length === 0) return;
  haptics.select();
  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: [...actions.map((a) => a.label), "Cancel"],
      cancelButtonIndex: actions.length,
      destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter((i) => i >= 0),
      tintColor: colors.accent,
      userInterfaceStyle: "dark",
    },
    (i) => actions[i]?.onPress(),
  );
}

/** The same actions in VoiceOver's actions rotor, so nothing depends on long-press. */
export function a11yActions(actions: ContentAction[]) {
  return {
    accessibilityActions: actions.map((a) => ({ name: a.label, label: a.label })),
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => actions.find((a) => a.label === e.nativeEvent.actionName)?.onPress(),
  };
}

/** The "..." / long-press menu for a photo or comment. */
export function useContentMenu() {
  const build = useContentActions();
  return (item: ContentMenuItem) => showActions(build(item));
}

export function isApiError(e: unknown, status: number): e is ApiError {
  return e instanceof ApiError && e.status === status;
}
