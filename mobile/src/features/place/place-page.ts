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

/** "3 stamps over 2 visits", "1 stamp, 1 visit", or null when there are none. */
export function visitSummary(visits: MyPlacePageResponse["visits"]): string | null {
  const stamps = visits.reduce((n, v) => n + v.stamps.length, 0);
  if (stamps === 0) return null;
  return `${plural(stamps, "stamp")} over ${plural(visits.length, "visit")}`.replace("1 stamp over 1 visit", "1 stamp, 1 visit");
}

/** Current proximity is useful for verification, but it never controls whether a stamp can be created. */
export function standing(data: Pick<MyPlacePageResponse, "inside" | "distanceM">, format: (m: number) => string): { text: string | null; canVerify: boolean } {
  if (data.inside === null) return { text: null, canVerify: false };
  if (data.inside) return { text: "Visit can be verified", canVerify: true };
  return { text: data.distanceM === null ? null : `${format(data.distanceM)} away`, canVerify: false };
}

/** One line for a stamp in the list: visit time, then caption/song/photo count. */
export function stampLine(s: MyPlacePageResponse["stamps"][number]): string {
  const { time } = visaStamp(s.visitedAt);
  const what = s.caption.trim() || (s.song ? `${s.song.title}, ${s.song.artist}` : s.photos.length > 0 ? `${plural(s.photos.length, "photo")}` : "");
  return [time, what].filter(Boolean).join("  ·  ");
}
