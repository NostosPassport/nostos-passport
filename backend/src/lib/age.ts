/**
 * The 21+ age gate. A birthdate is read once to answer "is this person 21 or older today?" and is never stored: there is
 * no birthdate column anywhere, and a refused attempt writes nothing at all (no account, no email, no log row).
 * "Today" is the calendar date in New York, where the app operates.
 */
import { localParts } from "@/lib/time";

export const MIN_AGE = 21;

export type YMD = { y: number; m: number; d: number };

/** A real calendar date written YYYY-MM-DD, or null. "2001-02-29" and "2001-13-01" are not dates. */
export function parseBirthdate(input: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Whole years between a birthdate and a day. A birthday counts from its own date. */
export function ageOn(birth: YMD, today: YMD): number {
  const had = today.m > birth.m || (today.m === birth.m && today.d >= birth.d);
  return today.y - birth.y - (had ? 0 : 1);
}

export function todayInNewYork(now: Date): YMD {
  const p = localParts(now);
  return { y: p.year, m: p.month, d: p.day };
}

/** True when the birthdate is a real date in the past and the person is at least 21 today. */
export function isOldEnough(birthdate: string, now = new Date()): boolean {
  const birth = parseBirthdate(birthdate);
  if (!birth) return false;
  const today = todayInNewYork(now);
  const age = ageOn(birth, today);
  return age >= MIN_AGE && age < 130;
}
