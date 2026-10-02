"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { distanceMeters } from "@/lib/geo";
import { useLocation } from "@/components/location/LocationProvider";

const PING_EVERY_MS = 5 * 60_000; // keeps presence fresh well inside the 45-minute expiry
const MIN_MOVE_M = 25; // ignore GPS jitter
const MIN_GAP_MS = 30_000; // never ping more often than this on movement

type Props = { venueId: string; signedIn: boolean; isOwner: boolean; initialGoing: boolean; initialHere: boolean };

/** Records "here now" while the page is open inside the geofence, and toggles "going tonight". */
export function PresenceRsvp({ venueId, signedIn, isOwner, initialGoing, initialHere }: Props) {
  const router = useRouter();
  const { pos } = useLocation();
  const [here, setHere] = useState(initialHere);
  const [going, setGoing] = useState(initialGoing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = signedIn && !isOwner;

  const posRef = useRef(pos);
  posRef.current = pos;
  const hereRef = useRef(here);
  hereRef.current = here;
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const ping = useCallback(async () => {
    const p = posRef.current;
    if (!p) return;
    last.current = { at: Date.now(), lat: p.lat, lng: p.lng };
    try {
      const res = await api<{ here: boolean }>(`/api/venues/${venueId}/presence`, { method: "POST", json: { lat: p.lat, lng: p.lng } });
      if (res.here !== hereRef.current) {
        setHere(res.here);
        router.refresh();
      }
    } catch {
      /* presence is best-effort */
    }
  }, [venueId, router]);

  // Steady 5-minute refresh, independent of GPS updates.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(ping, PING_EVERY_MS);
    return () => clearInterval(id);
  }, [enabled, ping]);

  // First fix, and real movement (>25 m, at most every 30 s).
  useEffect(() => {
    if (!enabled || !pos) return;
    const l = last.current;
    if (l && (Date.now() - l.at < MIN_GAP_MS || distanceMeters(l, pos) < MIN_MOVE_M)) return;
    ping();
  }, [enabled, pos, ping]);

  if (!enabled) return null;

  async function toggleGoing() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/venues/${venueId}/rsvp`, { method: going ? "DELETE" : "PUT" });
      setGoing(!going);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
      <button
        onClick={toggleGoing}
        disabled={busy}
        aria-pressed={going}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${going ? "bg-accent text-ink" : "border border-accent/60 text-accent"}`}
      >
        {going ? "✓ Going tonight" : "I'm going tonight"}
      </button>
      <span className={`rounded-full px-3 py-1 text-xs ${here ? "bg-chill/15 text-chill" : "bg-panel-2 text-muted"}`}>
        {here ? "📍 You're counted as here now" : "Not here (open this page within 100 m to check in)"}
      </span>
      <Link href="/people" className="ml-auto text-xs text-muted underline">Find friends</Link>
      {error && <p className="w-full text-xs text-packed">{error}</p>}
    </div>
  );
}
