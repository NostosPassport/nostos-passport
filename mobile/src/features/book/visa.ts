/** How a stamp's date and place read on its visa page. Dates are New York time: that is where every place is. */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function parts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  const get = (type: string) => f.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: Number(get("month")), day: get("day").padStart(2, "0"), hour: get("hour"), minute: get("minute"), period: get("dayPeriod").toUpperCase() };
}

/** "03 OCT 2026" and "9:41 PM", in New York. Empty strings for a date that doesn't parse. */
export function visaStamp(iso: string): { date: string; time: string } {
  const p = parts(iso);
  if (!p) return { date: "", time: "" };
  return { date: `${p.day} ${MONTHS[p.month - 1]} ${p.year}`, time: `${p.hour}:${p.minute} ${p.period}` };
}

/** The spoken line under the stamp: "Katz's, East Village, 03 OCT 2026 at 9:41 PM. Page 3." */
export function visaLabel(placeName: string, neighborhood: string, iso: string, page: number | null): string {
  const { date, time } = visaStamp(iso);
  return [placeName, neighborhood, date && `${date} at ${time}`].filter(Boolean).join(", ") + (page ? `. Page ${page}.` : ".");
}
