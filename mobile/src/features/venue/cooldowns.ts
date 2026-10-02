/**
 * Remembers that the server refused a post with a cooldown (429), per venue and report kind, so the
 * report bar can say so. The server's exact sentence ("Try again in 12 min") is shown only where it
 * arrived (the sheet); the bar uses a timeless line so it never shows a stale countdown. Notices fade
 * after `NOTICE_TTL_MS` (display only) or when a post of that kind succeeds. The server still decides.
 */
import { useSyncExternalStore } from "react";

export type ReportKind = "VIBE" | "LINE" | "COVER" | "PHOTO";
type Notice = { message: string; at: number };

export const NOTICE_TTL_MS = 15 * 60_000;

let notices: Record<string, Partial<Record<ReportKind, Notice>>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const cooldowns = {
  set(venueId: string, kind: ReportKind, message: string) {
    notices = { ...notices, [venueId]: { ...notices[venueId], [kind]: { message, at: Date.now() } } };
    emit();
  },
  clear(venueId: string, kind: ReportKind) {
    if (!notices[venueId]?.[kind]) return;
    const next = { ...notices[venueId] };
    delete next[kind];
    notices = { ...notices, [venueId]: next };
    emit();
  },
  /** The newest unexpired notice for a venue. */
  latest(venueId: string, now = Date.now()): (Notice & { kind: ReportKind }) | null {
    const entries = Object.entries(notices[venueId] ?? {}) as [ReportKind, Notice][];
    const live = entries.filter(([, n]) => now - n.at < NOTICE_TTL_MS).sort((a, b) => b[1].at - a[1].at);
    return live.length ? { kind: live[0][0], ...live[0][1] } : null;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  snapshot: () => notices,
  /** @internal tests */
  _reset() {
    notices = {};
    emit();
  },
};

export function useCooldownNotice(venueId: string) {
  useSyncExternalStore(cooldowns.subscribe, cooldowns.snapshot, cooldowns.snapshot);
  return cooldowns.latest(venueId);
}

const NOUN: Record<ReportKind, string> = { VIBE: "a vibe update", LINE: "a line update", COVER: "a cover update", PHOTO: "a photo" };

/** Bar copy for a cooldown notice: no countdown, so it can't go stale. */
export function cooldownLine(kind: ReportKind): string {
  return `You posted ${NOUN[kind]} here recently. You can post again soon.`;
}
