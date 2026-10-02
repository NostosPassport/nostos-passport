"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { distanceMeters, GEOFENCE_METERS } from "@/lib/geo";
import { LINE_META, LINES, VIBE_META, VIBES } from "@/lib/vibe-ui";
import { useLocation } from "@/components/location/LocationProvider";

type Venue = { id: string; lat: number; lng: number; name: string };
type Toast = { kind: "ok" | "err"; text: string } | null;

export function ReportPanel({ venue, signedIn, isOwner }: { venue: Venue; signedIn: boolean; isOwner: boolean }) {
  const router = useRouter();
  const loc = useLocation();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [cover, setCover] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn && !loc.pos) loc.requestGps();
  }, [signedIn, loc]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (isOwner) {
    return (
      <p className="mx-3 mb-3 rounded-2xl border border-venue/30 bg-venue/5 px-3 py-2.5 text-sm text-muted">
        You manage this venue, so live reports come from customers, not from you. You can reply to comments and flag content from your{" "}
        <Link href="/owner" className="text-venue underline">venue dashboard</Link>.
      </p>
    );
  }
  if (!signedIn) {
    return (
      <p className="mx-3 mb-3 rounded-2xl bg-panel-2 px-3 py-2.5 text-center text-sm text-muted">
        <Link href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`} className="text-accent">Sign in</Link> to report what it&apos;s like.
      </p>
    );
  }

  const dist = loc.pos ? distanceMeters(loc.pos, venue) : null;
  const inside = dist !== null && dist <= GEOFENCE_METERS;

  async function send(key: string, body: Record<string, unknown>): Promise<boolean> {
    if (!loc.pos) return false;
    setBusy(key);
    try {
      await api(`/api/venues/${venue.id}/reports`, { method: "POST", json: { ...body, lat: loc.pos.lat, lng: loc.pos.lng } });
      setToast({ kind: "ok", text: "Thanks! Your report is live." });
      router.refresh();
      return true;
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function sendPhoto(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !loc.pos) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ kind: "err", text: "Photos must be 5 MB or smaller" });
      return;
    }
    setBusy("photo");
    const fd = new FormData();
    fd.set("photo", file);
    fd.set("caption", caption);
    fd.set("lat", String(loc.pos.lat));
    fd.set("lng", String(loc.pos.lng));
    try {
      await api(`/api/venues/${venue.id}/photos`, { method: "POST", body: fd });
      setToast({ kind: "ok", text: "Photo posted." });
      setCaption("");
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setToast({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const disabled = !inside || busy !== null;
  const chip = "rounded-xl px-2 py-2.5 text-sm font-medium transition active:scale-95 disabled:opacity-40";

  return (
    <div className="mx-3 mb-3 space-y-3 rounded-2xl bg-panel-2 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted">Report now</span>
        <span className={inside ? "text-chill" : "text-warn"}>
          {dist === null
            ? loc.error ?? "Finding your location…"
            : inside
              ? `You're here (${Math.round(dist)} m)`
              : `${Math.round(dist)} m away, must be within ${GEOFENCE_METERS} m`}
        </span>
      </div>
      {process.env.NODE_ENV === "development" && !inside && (
        <button
          onClick={() => loc.setSimulated({ lat: venue.lat + 0.0002, lng: venue.lng })}
          className="w-full rounded-xl border border-dashed border-warn/60 py-1.5 text-xs text-warn"
        >
          Dev: put my fake location at {venue.name}
        </button>
      )}

      <div>
        <div className="mb-1 text-xs text-muted">Vibe</div>
        <div className="grid grid-cols-4 gap-1.5">
          {VIBES.map((v) => (
            <button key={v} disabled={disabled} onClick={() => send(`vibe-${v}`, { type: "VIBE", vibe: v })} className={chip} style={{ background: `${VIBE_META[v].color}33`, color: VIBE_META[v].text }}>
              {busy === `vibe-${v}` ? "…" : VIBE_META[v].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-muted">Line</div>
        <div className="grid grid-cols-4 gap-1.5">
          {LINES.map((l) => (
            <button key={l} disabled={disabled} onClick={() => send(`line-${l}`, { type: "LINE", line: l })} className={`${chip} bg-panel`}>
              {busy === `line-${l}` ? "…" : LINE_META[l].short}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-muted">Cover</div>
        <div className="flex gap-1.5">
          <button disabled={disabled} onClick={() => send("cover-free", { type: "COVER", cover: "free" })} className={`${chip} bg-panel px-4`}>
            Free
          </button>
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (cover.trim()) send("cover", { type: "COVER", cover }).then((ok) => ok && setCover(""));
            }}
          >
            <label className="flex flex-1 items-center rounded-xl bg-panel px-2">
              <span className="text-muted">$</span>
              <input
                inputMode="decimal"
                value={cover}
                onChange={(e) => setCover(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="20"
                className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
                aria-label="Cover in dollars"
                disabled={!inside}
              />
            </label>
            <button disabled={disabled || !cover} className={`${chip} bg-accent px-4 text-ink`}>
              {busy === "cover" ? "…" : "Send"}
            </button>
          </form>
        </div>
      </div>

      <form onSubmit={sendPhoto} className="space-y-1.5">
        <div className="text-xs text-muted">Photo</div>
        <div className="flex gap-1.5">
          <label className={`${chip} flex flex-1 cursor-pointer items-center justify-center truncate bg-panel ${!inside ? "pointer-events-none opacity-40" : ""}`}>
            {fileName ?? "📷 Choose photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              disabled={!inside}
            />
          </label>
        </div>
        {fileName && (
          <div className="flex gap-1.5">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder="Short caption" className="flex-1 rounded-xl bg-panel px-3 py-2 text-sm outline-none" />
            <button disabled={disabled} className={`${chip} bg-accent px-4 text-ink`}>{busy === "photo" ? "…" : "Post"}</button>
          </div>
        )}
      </form>

      <p className="text-[10px] text-muted">One report of each kind per venue every 15 minutes. Newer reports count more; older than 3 hours, not at all.</p>
      {toast && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm ${toast.kind === "ok" ? "bg-chill/15 text-chill" : "bg-packed/15 text-packed"}`}>{toast.text}</p>
      )}
    </div>
  );
}
