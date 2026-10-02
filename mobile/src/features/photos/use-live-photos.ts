import { useEffect, useState } from "react";

import type { PhotoView } from "@/api/contracts";

/** API.md: live photos are the last 3 hours. Drop one when createdAt + 3 h passes, by the server's clock. */
export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Photos still live at `serverNowMs`. */
export function stillLive(photos: PhotoView[], serverNowMs: number): PhotoView[] {
  return photos.filter((p) => Date.parse(p.createdAt) + LIVE_WINDOW_MS > serverNowMs);
}

/**
 * Filters `livePhotos` against the server's clock (the page's `now`, advanced by local time elapsed
 * since the fetch) and calls `onExpire` when one crosses the line, so the page refetches.
 */
export function useLivePhotos(photos: PhotoView[], serverNow: string, fetchedAt: number, onExpire: () => void): PhotoView[] {
  const offset = Date.parse(serverNow) - fetchedAt;
  // Local clock, advanced by the expiry timer. Between ticks the server's own list is authoritative.
  const [clock, setClock] = useState(() => Date.now());
  // After a refetch the server's list is fresh as of fetchedAt, so never estimate from an older clock.
  const live = stillLive(photos, Math.max(clock, fetchedAt) + offset);
  const nextExpiry = live.length ? Math.min(...live.map((p) => Date.parse(p.createdAt) + LIVE_WINDOW_MS)) : null;

  useEffect(() => {
    if (nextExpiry === null) return;
    const wait = Math.max(1000, nextExpiry - (Date.now() + offset) + 500);
    const t = setTimeout(() => {
      setClock(Date.now());
      onExpire();
    }, wait);
    return () => clearTimeout(t);
  }, [nextExpiry, offset, onExpire]);

  return live;
}
