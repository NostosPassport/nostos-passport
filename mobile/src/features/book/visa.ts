const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function parts(iso: string, timeZone: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  const get = (type: string) => f.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: Number(get("month")), day: get("day").padStart(2, "0"), hour: get("hour"), minute: get("minute"), period: get("dayPeriod").toUpperCase() };
}

export function visaStamp(iso: string, timeZone = "UTC"): { date: string; time: string } {
  const p = parts(iso, timeZone);
  if (!p) return { date: "", time: "" };
  return { date: `${p.day} ${MONTHS[p.month - 1]} ${p.year}`, time: `${p.hour}:${p.minute} ${p.period}` };
}

export function visaLabel(placeName: string, locality: string, iso: string, page: number | null, timeZone = "UTC"): string {
  const { date, time } = visaStamp(iso, timeZone);
  return [placeName, locality, date && `${date} at ${time}`].filter(Boolean).join(", ") + (page ? `. Page ${page}.` : ".");
}
