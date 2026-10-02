/** Moderation copy: the API's raw actions, in words. */
import type { z } from "zod";

import type { ModerationAction as ModerationActionSchema } from "@/api/contracts";

type ModerationAction = z.infer<typeof ModerationActionSchema>;

const ACTION_WORD: Record<ModerationAction, string> = {
  FLAGGED: "Flagged",
  AUTO_HIDE: "Auto-hidden",
  HIDE: "Hidden",
  DISMISS: "Dismissed",
  RESTORE: "Restored",
  ACCOUNT_DELETED: "Account deleted",
  SUSPEND: "Suspended",
  UNSUSPEND: "Unsuspended",
};

export function actionWord(a: ModerationAction): string {
  return ACTION_WORD[a];
}

/** Reputation (0.2 to 1.5, new users 0.5) as a percentage of the default. */
export function reputationText(rep: number): string {
  return `trust ${Math.round((rep / 0.5) * 100)}%`;
}
