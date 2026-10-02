/** Moderation copy: the API's raw previews and actions, in words. */
import type { z } from "zod";

import type { LineWait, ModerationAction as ModerationActionSchema, Vibe } from "@/api/contracts";
import { formatCents, LINE_LABEL, VIBE_LABEL } from "@/lib/format";

type ModerationAction = z.infer<typeof ModerationActionSchema>;

/** Report previews arrive as "vibe: PACKED", "line: TEN_TO_30", "cover: cover 20 USD". */
export function prettyPreview(preview: string): string {
  const m = /^(vibe|line|cover):\s*(.+)$/.exec(preview);
  if (!m) return preview;
  const [, kind, value] = m;
  if (kind === "vibe" && value in VIBE_LABEL) return `Vibe: ${VIBE_LABEL[value as Vibe]}`;
  if (kind === "line" && value in LINE_LABEL) return `Line: ${value === "NONE" ? "No line" : LINE_LABEL[value as LineWait]}`;
  const dollars = /cover\s+([\d.]+)\s+USD/.exec(value);
  if (kind === "cover" && dollars) return `Cover: ${formatCents(Math.round(Number(dollars[1]) * 100))}`;
  return preview;
}

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
