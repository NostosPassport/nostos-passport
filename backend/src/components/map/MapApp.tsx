"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { distanceMeters } from "@/lib/geo";
import { VIBE_META } from "@/lib/vibe-ui";
import { useLocation } from "@/components/location/LocationProvider";
import type { MapVenue } from "@/server/services/venues";
import type { SortKey } from "@/lib/sort-venues";
import { sortVenues } from "@/lib/sort-venues";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-panel" aria-label="Loading map" />,
});

const REFRESH_MS = 60_000;

function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export function MapApp({ initialVenues, signedIn, nav }: { initialVenues: MapVenue[]; signedIn: boolean; nav: React.ReactNode }) {
  const [venues, setVenues] = useState(initialVenues);
  const [sort, setSort] = useState<SortKey>("activity");
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simMode, setSimMode] = useState(false);
  const [stale, setStale] = useState(false);
  const loc = useLocation();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/venues", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setVenues(((await res.json()) as { venues: MapVenue[] }).venues);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const sorted = useMemo(() => sortVenues(venues, sort, loc.pos, distanceMeters), [venues, sort, loc.pos]);
  const selected = venues.find((v) => v.id === selectedId) ?? null;

  const tab = (key: SortKey, label: string) => (
    <button
      key={key}
      onClick={() => {
        setSort(key);
        if (key === "distance" && !loc.pos) loc.requestGps();
      }}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${sort === key ? "bg-text text-ink" : "bg-panel-2 text-muted"}`}
      aria-pressed={sort === key}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <LeafletMap
        venues={venues}
        userPos={loc.pos}
        userIsSimulated={loc.source === "simulated"}
        selectedId={selectedId}
        simMode={simMode}
        onSelect={(id) => {
          setSelectedId(id);
          setExpanded(false);
        }}
        onMapClick={(p) => {
          loc.setSimulated(p);
          setSimMode(false);
        }}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto shrink-0 rounded-2xl bg-ink/85 px-3 py-2 backdrop-blur">
          <div className="whitespace-nowrap text-lg font-bold leading-none text-accent">Nostos</div>
          <div className="mt-1 whitespace-nowrap text-[11px] text-muted">
            {stale ? "Offline: showing last update" : "Live · East Village & LES"}
          </div>
        </div>
        <div className="pointer-events-auto">{nav}</div>
      </div>

      {/* Legend */}
      <div className="absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] z-[900] space-y-1 rounded-xl bg-ink/80 px-2.5 py-2 text-[11px] backdrop-blur">
        {(["PACKED", "BUSY", "CHILL", "DEAD"] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: VIBE_META[k].color }} />
            {VIBE_META[k].label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: VIBE_META.NO_DATA.color }} />
          No data
        </div>
      </div>

      {/* Dev-only location simulator */}
      {/* Inline NODE_ENV check so the simulator is stripped from production bundles. */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] z-[900] flex flex-col items-end gap-1.5">
          <button
            onClick={() => setSimMode((s) => !s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow ${simMode ? "bg-warn text-ink" : "bg-ink/85 text-warn ring-1 ring-warn/50"}`}
          >
            {simMode ? "Tap the map…" : "📍 Dev: set location"}
          </button>
          {loc.source === "simulated" && (
            <button onClick={() => loc.setSimulated(null)} className="rounded-full bg-ink/85 px-2.5 py-1 text-[11px] text-muted">
              Clear fake location
            </button>
          )}
        </div>
      )}

      {/* Selected venue card */}
      {selected && !expanded && (
        <div className="absolute inset-x-3 bottom-[calc(38dvh+0.75rem)] z-[1000] rounded-2xl border border-line bg-panel p-3 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{selected.name}</div>
              <div className="text-xs text-muted">{selected.address}</div>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-muted" aria-label="Close">✕</button>
          </div>
          <VenueStats v={selected} />
          <Link href={`/v/${selected.slug}`} className="mt-3 block rounded-xl bg-accent py-2 text-center text-sm font-semibold text-ink">
            Open venue
          </Link>
        </div>
      )}

      {/* Bottom sheet */}
      <section
        className={`absolute inset-x-0 bottom-0 z-[1001] flex flex-col rounded-t-3xl border-t border-line bg-panel shadow-2xl transition-[height] duration-300 ${expanded ? "h-[80dvh]" : "h-[38dvh]"}`}
        aria-label="Venues"
      >
        <button onClick={() => setExpanded((e) => !e)} className="flex w-full justify-center pb-1 pt-2" aria-label={expanded ? "Collapse list" : "Expand list"}>
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </button>
        <div className="flex items-center gap-2 px-4 pb-2">
          {tab("activity", "Live now")}
          {tab("going", "Going tonight")}
          {tab("distance", "Nearby")}
        </div>
        {sort === "distance" && !loc.pos && (
          <p className="px-4 pb-2 text-xs text-warn">
            {loc.error ?? "Waiting for your location…"} {process.env.NODE_ENV === "development" && "Or use “Dev: set location”."}
          </p>
        )}
        <ul className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sorted.length === 0 && <li className="p-6 text-center text-sm text-muted">No venues yet.</li>}
          {sorted.map((v) => (
            <li key={v.id}>
              <Link
                href={`/v/${v.slug}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-panel-2"
                onMouseEnter={() => setSelectedId(v.id)}
              >
                <VibeDot vibe={v.vibe} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{v.name}</span>
                    {v.friendsGoing > 0 && (
                      <span className="shrink-0 rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold text-accent">
                        👥 {v.friendsGoing}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {VIBE_META[v.vibe].label}
                    {v.vibe !== "NO_DATA" && ` · ${v.vibeReports} reports`} · {v.hereNow} here · {v.goingTonight} going
                    {loc.pos && ` · ${fmtDistance(distanceMeters(loc.pos, v))}`}
                  </div>
                </div>
                {v.promoted && <span className="shrink-0 rounded border border-warn/50 px-1 text-[9px] uppercase tracking-wide text-warn">Promoted</span>}
              </Link>
            </li>
          ))}
        </ul>
        {/* Always visible: map tiles and imported venue data are © OpenStreetMap contributors (ODbL). */}
        <p className="border-t border-line px-4 py-1.5 text-center text-[10px] text-muted">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a>
        </p>
        {!signedIn && (
          <p className="border-t border-line px-4 py-2 text-center text-xs text-muted">
            <Link href="/login" className="text-accent">Sign in</Link> to report, RSVP and see friends.
          </p>
        )}
      </section>
    </div>
  );
}

function VibeDot({ vibe }: { vibe: MapVenue["vibe"] }) {
  const meta = VIBE_META[vibe];
  return vibe === "NO_DATA" ? (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-dashed text-xs font-bold" style={{ borderColor: meta.color, color: meta.color }}>?</span>
  ) : (
    <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}66` }} />
  );
}

function VenueStats({ v }: { v: MapVenue }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      <span className="rounded-full px-2 py-0.5 font-semibold text-ink" style={{ background: VIBE_META[v.vibe].color }}>
        {VIBE_META[v.vibe].label}
      </span>
      <span className="rounded-full bg-panel-2 px-2 py-0.5">{v.hereNow} here now</span>
      <span className="rounded-full bg-panel-2 px-2 py-0.5">{v.goingTonight} going</span>
      {v.friendsGoing > 0 && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent">👥 {v.friendsGoing} friends</span>}
      {v.promoted && <span className="rounded-full border border-warn/50 px-2 py-0.5 text-warn">Promoted</span>}
    </div>
  );
}
