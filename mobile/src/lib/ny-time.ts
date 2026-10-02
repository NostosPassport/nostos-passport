/** Venue times are New York wall-clock (API.md), whatever time zone the phone is in. */
const NY = "America/New_York";

function parts(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

/** An instant as New York local "YYYY-MM-DDTHH:MM" (the promo API's format). */
export function toNyLocal(d: Date): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Time-of-day pickers run in UTC (`timeZoneName="UTC"`) on a fixed date, so a daylight-saving day in
 * the phone's zone can never skip or repeat an hour. These convert between that Date and "HH:MM".
 */
export function toHHMM(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fromHHMM(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h || 0, m || 0));
}

/** Round up to the next quarter hour (pickers step in 15 minutes). */
export function nextQuarterHour(d: Date): Date {
  const q = 15 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / q) * q);
}

/** "Fri, Sep 26, 9 PM" in New York time, for promo windows. */
export function formatNy(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":00", "");
}
