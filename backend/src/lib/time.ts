/**
 * Time conventions: everything is stored in UTC. Historical "night" helpers below use America/New_York,
 * where a night runs from 5:00am local to 4:59:59.999am local the next day. Place-specific visit dates should use
 * `calendarDayKey` with the venue's IANA time zone instead of these New York night helpers.
 */
export const NIGHT_TZ = "America/New_York";
export const NIGHT_ROLLOVER_HOUR = 5;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
    return formatter;
  } catch {
    return formatterFor("UTC");
  }
}

function partsInTimeZone(date: Date, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Wall-clock components of an instant in America/New_York. */
export function localParts(date: Date): LocalParts {
  return partsInTimeZone(date, NIGHT_TZ);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendar date at a place, falling back to UTC when a venue has no usable IANA time zone. */
export function calendarDayKey(date: Date, timeZone?: string | null): string {
  const p = partsInTimeZone(date, timeZone?.trim() || "UTC");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The night an instant belongs to, as YYYY-MM-DD (local date the night started on). */
export function nightKey(date: Date): string {
  const p = localParts(date);
  const cal = new Date(Date.UTC(p.year, p.month - 1, p.day));
  if (p.hour < NIGHT_ROLLOVER_HOUR) cal.setUTCDate(cal.getUTCDate() - 1);
  return `${cal.getUTCFullYear()}-${pad(cal.getUTCMonth() + 1)}-${pad(cal.getUTCDate())}`;
}

/** Calendar arithmetic on a night key (YYYY-MM-DD), independent of daylight saving time. */
export function addNights(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Offset of America/New_York from UTC at an instant, in ms (e.g. -4h during EDT). */
function tzOffsetMs(date: Date): number {
  const p = localParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of a local America/New_York wall-clock time (resolves DST gaps forward). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - tzOffsetMs(new Date(guess));
  ts = guess - tzOffsetMs(new Date(ts));
  return new Date(ts);
}

/** [start, end) of a night in UTC. */
export function nightBounds(key: string): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const start = zonedTimeToUtc(y, m, d, NIGHT_ROLLOVER_HOUR);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const end = zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), NIGHT_ROLLOVER_HOUR);
  return { start, end };
}

/** Human-friendly "12 min ago" style age. */
export function formatAge(from: Date, now: Date): string {
  const mins = Math.max(0, Math.floor((now.getTime() - from.getTime()) / MINUTE_MS));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
