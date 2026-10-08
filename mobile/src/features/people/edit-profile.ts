import type { ProfileSettingsRequest } from "@/api/contracts";

export const BIO_MAX = 150;
export const NAME_MAX = 60;

export type ProfileValues = { displayName: string; bio: string };

export function profileChanges(initial: ProfileValues, values: ProfileValues): ProfileSettingsRequest {
  const out: ProfileSettingsRequest = {};
  if (values.displayName.trim() !== initial.displayName.trim()) out.displayName = values.displayName.trim();
  if (values.bio.trim() !== initial.bio.trim()) out.bio = values.bio.trim();
  return out;
}

export function profileProblem(values: ProfileValues): string | null {
  if (values.displayName.trim() === "") return "Add a display name.";
  if (values.displayName.trim().length > NAME_MAX) return `Keep your name under ${NAME_MAX + 1} characters.`;
  if (values.bio.trim().length > BIO_MAX) return `Keep your bio to ${BIO_MAX} characters.`;
  return null;
}
