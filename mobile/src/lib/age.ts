/**
 * The 13+ eligibility gate on the phone. The birthdate is typed as MM/DD/YYYY, checked here and, for sign-up, sent to the server
 * once. The server checks it again and never stores it. The age boundary is the New York calendar date, matching the backend.
 */
export const MIN_AGE = 13;
export const UNDERAGE_NOTICE = "Nostos is for people 13 and older.";

export type YMD = { y: number; m: number; d: number };

export function formatBirthdateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((p) => p !== "");
  return parts.join("/");
}

export function parseBirthdate(input: string): YMD | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function toApiDate(b: YMD): string {
  return `${String(b.y).padStart(4, "0")}-${String(b.m).padStart(2, "0")}-${String(b.d).padStart(2, "0")}`;
}

export function ageOn(birth: YMD, today: YMD): number {
  const had = today.m > birth.m || (today.m === birth.m && today.d >= birth.d);
  return today.y - birth.y - (had ? 0 : 1);
}

const newYorkDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric",
});

export function today(now = new Date()): YMD {
  const parts = newYorkDate.formatToParts(now);
  const value = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)!.value);
  return { y: value("year"), m: value("month"), d: value("day") };
}

export type AgeCheck = { ok: true; apiDate: string } | { ok: false; reason: "format" | "underage"; message: string };

export function checkBirthdate(input: string, now = new Date()): AgeCheck {
  const birth = parseBirthdate(input);
  const t = today(now);
  if (!birth || birth.y < 1900 || ageOn(birth, t) < 0) return { ok: false, reason: "format", message: "Enter your birthdate as MM/DD/YYYY." };
  if (ageOn(birth, t) < MIN_AGE) return { ok: false, reason: "underage", message: UNDERAGE_NOTICE };
  return { ok: true, apiDate: toApiDate(birth) };
}
