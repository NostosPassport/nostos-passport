import { nightKey } from "@/lib/time";

export type HoursEntry = { day: number; open: string; close: string };
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** Hours for the current night (the night that started at 5am local on its calendar day). */
export function hoursTonight(hours: HoursEntry[], now: Date): HoursEntry | null {
  const key = nightKey(now);
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return hours.find((h) => h.day === weekday) ?? null;
}

export function fmtRange(h: HoursEntry) {
  return `${fmtClock(h.open)}–${fmtClock(h.close)}`;
}
