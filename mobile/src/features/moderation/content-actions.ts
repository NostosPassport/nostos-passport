/**
 * Report and Block for user content (Guideline 1.2): every stamp and profile can be reported, and every author
 * blocked. Native action sheets and alerts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActionSheetIOS, Alert } from "react-native";

import { api, ApiError, errorText } from "@/api";
import type { FlagCategory, TargetType } from "@/api/contracts";
import { useAuth } from "@/auth/auth-context";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { colors } from "@/theme";
import { flaggedStore } from "./flagged-store";

/** What a person can say is wrong. The server stores the label as the reason and the category for moderators. */
export const REPORT_REASONS: readonly { label: string; category: FlagCategory }[] = [
  { label: "Spam or scam", category: "SPAM" },
  { label: "Harassment or hate", category: "HARASSMENT" },
  { label: "Sexual or violent content", category: "SEXUAL_OR_VIOLENT" },
  { label: "Not at this place", category: "NOT_AT_PLACE" },
  { label: "Stalking or unwanted contact", category: "STALKING" },
  { label: "Under 21 or looks underage", category: "UNDERAGE" },
  { label: "Someone's private information", category: "PRIVATE_INFO" },
];

export type ChosenReason = { reason: string; category: FlagCategory };

export function useFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { targetType: TargetType; targetId: string; reason: string; category: FlagCategory }) => api.flags.create(v),
    onSuccess: (res, v) => {
      haptics.success();
      if (v.targetType === "STAMP") flaggedStore.add(v.targetId);
      toast.show(res.autoHidden ? "Thanks. It's hidden while we review it." : "Thanks. We'll take a look.");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (e, v) => {
      haptics.warning();
      if (e instanceof ApiError && e.status === 409 && v.targetType === "STAMP") flaggedStore.add(v.targetId);
      toast.show(errorText(e, "Couldn't send that report. Try again."), "neutral");
    },
  });
}

/** Block or unblock a person by handle. */
export function useBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { handle: string; block: boolean }) => api.users.block(v.handle, v.block),
    onSuccess: (_r, v) => {
      toast.show(v.block ? `Blocked @${v.handle}.` : `Unblocked @${v.handle}.`);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.show(errorText(e, "Couldn't do that. Try again."), "neutral"),
  });
}

/** Ask for a reason, then flag. */
export function chooseReportReason(
  title: string,
  onPick: (chosen: ChosenReason) => void,
  reasons: readonly { label: string; category: FlagCategory }[] = REPORT_REASONS,
  message = "Reports are reviewed by moderators. The person isn't told who reported them.",
) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      message,
      options: [...reasons.map((r) => r.label), "Cancel"],
      cancelButtonIndex: reasons.length,
      tintColor: colors.accent,
    },
    (i) => {
      const r = reasons[i];
      if (r) onPick({ reason: r.label, category: r.category });
    },
  );
}

export function confirmBlock(handle: string, onConfirm: () => void) {
  Alert.alert(`Block @${handle}?`, "You won't see each other's stamps or profile, and follows are removed. They aren't notified.", [
    { text: "Cancel", style: "cancel" },
    { text: "Block", style: "destructive", onPress: onConfirm },
  ]);
}

export type StampMenuItem = {
  id: string;
  authorHandle: string;
  mine: boolean;
  /** Extra actions shown first (Edit, Delete from profile). */
  extra?: ContentAction[];
};

export type ContentAction = { label: string; destructive?: boolean; onPress: () => void };

/** The actions for a stamp: extras (Edit, Delete) first, then Report and Block for others' stamps. */
export function useStampActions(): (item: StampMenuItem) => ContentAction[] {
  const { status } = useAuth();
  const flag = useFlag();
  const block = useBlock();

  return (item) => {
    const actions: ContentAction[] = [...(item.extra ?? [])];
    if (!item.mine) {
      actions.push({
        label: "Report stamp",
        destructive: true,
        onPress: () => {
          if (status !== "signedIn") return router.push("/sign-in");
          chooseReportReason("Report this stamp", (chosen) => flag.mutate({ targetType: "STAMP", targetId: item.id, ...chosen }));
        },
      });
      actions.push({
        label: `Block @${item.authorHandle}`,
        destructive: true,
        onPress: () => {
          if (status !== "signedIn") return router.push("/sign-in");
          confirmBlock(item.authorHandle, () => block.mutate({ handle: item.authorHandle, block: true }));
        },
      });
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

export function isApiError(e: unknown, status: number): e is ApiError {
  return e instanceof ApiError && e.status === status;
}
