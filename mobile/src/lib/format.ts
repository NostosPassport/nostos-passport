/** Display formatting. Pure functions: no rules, only words and numbers. */
import type { LineWait, VibeState } from "@/api/contracts";

export const VIBE_LABEL: Record<VibeState, string> = {
  PACKED: "Packed",
  BUSY: "Busy",
  CHILL: "Chill",
  DEAD: "Dead",
  NO_DATA: "No data",
};

export const LINE_LABEL: Record<LineWait, string> = {
  NONE: "No line",
  UNDER_10: "Under 10 min",
  TEN_TO_30: "10–30 min",
  OVER_30: "30+ min",
};

/** How "no data" is said everywhere (lists, VoiceOver, empty states). */
export const NO_DATA_PHRASE = "No reports in the last hour";
export const NO_DATA_SPOKEN = "no reports in the last hour";

/** Integer cents to "$20", "$12.50" or "Free". */
export function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Server distance in meters to "140 m" or "1.2 km". */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${m} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** "just now", "4 min ago", "2 h ago", "3 d ago". `now` should be the server's time when available. */
export function formatAge(iso: string, now: Date | string = new Date()): string {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const s = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "1 report", "4 reports". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Map list secondary line: "Packed · 4 here · 18 going". */
export function venueSummary(v: { vibe: VibeState; hereNow: number; goingTonight: number }): string {
  const parts: string[] = [v.vibe === "NO_DATA" ? NO_DATA_PHRASE : VIBE_LABEL[v.vibe]];
  if (v.hereNow > 0) parts.push(`${v.hereNow} here`);
  if (v.goingTonight > 0) parts.push(`${v.goingTonight} going`);
  return parts.join(" · ");
}

/** "21:30" to "9:30 PM", "00:00" to "12 AM". */
export function formatClock(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12} ${suffix}` : `${h12}:${mStr} ${suffix}`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Display order for a week of hours: Monday first, the weekend together. API day 0 = Sunday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * The venue's "today" in New York, where the night runs 5:00am to 4:59am (API convention),
 * so at 1am on Saturday it's still Friday night.
 */
export function nightDayIndex(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return hour < 5 ? (idx + 6) % 7 : idx;
}

/**
 * Cover keypad input to the API's dollar string: "" stays "", "0" becomes "free",
 * otherwise digits with at most two decimals ("12.5" to "12.50").
 */
export function coverInputToApi(input: string): string {
  const t = input.trim();
  if (t === "" ) return "";
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "free";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Initial for avatars: first letter of the name or handle, uppercased. */
export function initial(name: string | null | undefined): string {
  const ch = (name ?? "").trim().replace(/^@/, "").charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** "2026-10" -> "October"; adds the year when it isn't `currentYear` ("October 2025"). */
export function monthName(ym: string, currentYear?: number): string {
  const [y, m] = ym.split("-").map(Number);
  const name = MONTHS[(m ?? 1) - 1] ?? ym;
  return currentYear !== undefined && y !== currentYear ? `${name} ${y}` : name;
}

/** "2026-10" -> "October's best" (the venue page's featured galleries). */
export function monthBest(ym: string, currentYear?: number): string {
  return `${monthName(ym, currentYear)}'s best`;
}

/** A night ("2026-09-20", New York) as "Sat, Sep 20". */
export function formatNight(night: string): string {
  return new Date(`${night}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
