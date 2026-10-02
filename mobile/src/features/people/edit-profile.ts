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
    ? "Only people you approve see your stamps, places and counts. Everyone else sees your handle and a Follow button."
    : "Anyone can see your passport: all your stamps and every place you've been.";
}

/** True when this save switches the account from private to public, which changes what strangers can see. */
export function goesPublic(initial: ProfileValues, change: ProfileSettingsRequest): boolean {
  return initial.isPrivate && change.isPrivate === false;
}

/**
 * The alert shown before switching from private to public. It lists exactly what changes, so nobody makes their
 * passport public by accident.
 */
export function goingPublicAlert(counts?: { stamps: number; places: number }): { title: string; message: string; confirm: string } {
  const have = counts && (counts.stamps > 0 || counts.places > 0) ? ` That includes your ${counts.stamps} ${counts.stamps === 1 ? "stamp" : "stamps"} and ${counts.places} ${counts.places === 1 ? "place" : "places"} so far.` : "";
  return {
    title: "Make your passport public?",
    message:
      "Anyone, signed in or not, will be able to see all of your stamps (photos, captions and songs) and every place you've been, including the ones you've already stamped." +
      have +
      " People will be able to follow you without asking. Pending follow requests stay pending until you approve them. You can switch back to private any time.",
    confirm: "Make public",
  };
}

/** Ask "Approve N pending requests?" only after switching from private to public with requests waiting. */
export function shouldOfferApproveAll(change: ProfileSettingsRequest, pendingRequests: number): boolean {
  return change.isPrivate === false && pendingRequests > 0;
}
