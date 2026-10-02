/** The place page's words. Pure. */
import type { z } from "zod";

import type { MyPlacePageResponse as MyPlaceSchema } from "@/api/contracts";
import { visaStamp } from "@/features/book/visa";
import { plural } from "@/lib/format";

type MyPlacePageResponse = z.infer<typeof MyPlaceSchema>;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-10-03" as "03 OCT 2026". The server's day is already a New York calendar day, so it is read as written. */
export function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${m[3]} ${month} ${m[1]}` : day;
}

/** "3 stamps over 2 nights", "1 stamp, 1 night", or null when there are none. */
export function visitSummary(visits: MyPlacePageResponse["visits"]): string | null {
  const stamps = visits.reduce((n, v) => n + v.stamps.length, 0);
  if (stamps === 0) return null;
  return `${plural(stamps, "stamp")} over ${plural(visits.length, "night")}`.replace("1 stamp over 1 night", "1 stamp, 1 night");
}

/** How you stand to the place right now: inside, so you can stamp; or how far; or nothing without a position. */
export function standing(data: Pick<MyPlacePageResponse, "inside" | "distanceM">, format: (m: number) => string): { text: string | null; canStamp: boolean } {
  if (data.inside === null) return { text: null, canStamp: false };
  if (data.inside) return { text: "You're here", canStamp: true };
  return { text: data.distanceM === null ? "Not here yet" : `${format(data.distanceM)} away`, canStamp: false };
}

/** One line for a stamp in the list: its time, then its caption or song if it has one. */
export function stampLine(s: MyPlacePageResponse["stamps"][number]): string {
  const { time } = visaStamp(s.createdAt);
  const what = s.caption.trim() || (s.song ? `${s.song.title}, ${s.song.artist}` : s.photos.length > 0 ? `${plural(s.photos.length, "photo")}` : "");
  return [time, what].filter(Boolean).join("  ·  ");
}
