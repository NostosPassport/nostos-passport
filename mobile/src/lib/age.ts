/**
 * The 21+ age gate on the phone. The birthdate is typed as MM/DD/YYYY, checked here and, for sign-up, sent to the server
 * once (which checks it again and never stores it). It is never kept on the device either: nothing about an
 * under-21 attempt is saved anywhere, and an under-21 birthdate is never sent to the server at all.
 */
export const MIN_AGE = 21;
export const UNDERAGE_NOTICE = "Nostos is for people 21 and older.";

export type YMD = { y: number; m: number; d: number };

/** Auto-format as the person types: digits only, slashes added after the month and day. "0505" -> "05/05". */
export function formatBirthdateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((p) => p !== "");
  return parts.join("/");
}

/** "MM/DD/YYYY" to a real calendar date, or null ("02/30/1990" and "13/01/1990" are not dates). */
export function parseBirthdate(input: string): YMD | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** The API's form of a birthdate: YYYY-MM-DD. */
export function toApiDate(b: YMD): string {
  return `${String(b.y).padStart(4, "0")}-${String(b.m).padStart(2, "0")}-${String(b.d).padStart(2, "0")}`;
}

/** Whole years between a birthdate and a day. A birthday counts from its own date. */
export function ageOn(birth: YMD, today: YMD): number {
  const had = today.m > birth.m || (today.m === birth.m && today.d >= birth.d);
  return today.y - birth.y - (had ? 0 : 1);
}

export const today = (now = new Date()): YMD => ({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });

export type AgeCheck = { ok: true; apiDate: string } | { ok: false; reason: "format" | "underage"; message: string };

/** Check what was typed. `underage` carries the one sentence to show; nothing is stored either way. */
export function checkBirthdate(input: string, now = new Date()): AgeCheck {
  const birth = parseBirthdate(input);
  const t = today(now);
  if (!birth || birth.y < 1900 || ageOn(birth, t) < 0) return { ok: false, reason: "format", message: "Enter your birthdate as MM/DD/YYYY." };
  if (ageOn(birth, t) < MIN_AGE) return { ok: false, reason: "underage", message: UNDERAGE_NOTICE };
  return { ok: true, apiDate: toApiDate(birth) };
}
