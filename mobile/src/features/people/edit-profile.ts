import type { ProfileSettingsRequest } from "@/api/contracts";

export const BIO_MAX = 150;
export const NAME_MAX = 60;

export type ProfileValues = { displayName: string; bio: string; isPrivate: boolean };

/** Only the fields that changed (the server takes a partial update). Text is compared trimmed. */
export function profileChanges(initial: ProfileValues, values: ProfileValues): ProfileSettingsRequest {
  const out: ProfileSettingsRequest = {};
  if (values.displayName.trim() !== initial.displayName.trim()) out.displayName = values.displayName.trim();
  if (values.bio.trim() !== initial.bio.trim()) out.bio = values.bio.trim();
  if (values.isPrivate !== initial.isPrivate) out.isPrivate = values.isPrivate;
  return out;
}

/** A sentence for what's wrong, or null. */
export function profileProblem(values: ProfileValues): string | null {
  if (values.displayName.trim() === "") return "Add a display name.";
  if (values.displayName.trim().length > NAME_MAX) return `Keep your name under ${NAME_MAX + 1} characters.`;
  if (values.bio.trim().length > BIO_MAX) return `Keep your bio to ${BIO_MAX} characters.`;
  return null;
}

/** The toggle's one-line explanation, for the state it's in now. */
export function privacyNote(isPrivate: boolean): string {
  return isPrivate
    ? "Only people you approve see your posts, places and badges. On venue pages, people you haven't approved see you as Anonymous."
    : "Anyone can see your profile and posts. Your handle shows on your past venue photos too.";
}

/** Ask "Approve N pending requests?" only after switching from private to public with requests waiting. */
export function shouldOfferApproveAll(change: ProfileSettingsRequest, pendingRequests: number): boolean {
  return change.isPrivate === false && pendingRequests > 0;
}
