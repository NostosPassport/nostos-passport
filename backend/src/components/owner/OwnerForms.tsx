"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { DAY_NAMES, type HoursEntry } from "@/lib/hours";

const input = "w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-venue";

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const note = msg && <p className={`text-xs ${msg.ok ? "text-chill" : "text-packed"}`} role="status">{msg.text}</p>;
  return { busy, run, note };
}

type Info = { name: string; address: string; officialCover: string; dressCode: string; hours: HoursEntry[] };

export function OfficialInfoForm({ venueId, initial }: { venueId: string; initial: Info }) {
  const [f, setF] = useState(initial);
  const { busy, run, note } = useSubmit();
  const setDay = (day: number, patch: Partial<HoursEntry> | null) =>
    setF((s) => {
      const rest = s.hours.filter((h) => h.day !== day);
      if (patch === null) return { ...s, hours: rest };
      const cur = s.hours.find((h) => h.day === day) ?? { day, open: "20:00", close: "02:00" };
      return { ...s, hours: [...rest, { ...cur, ...patch }].sort((a, b) => a.day - b.day) };
    });
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        // Send only what changed, so an untouched imported value never blocks saving an unrelated field.
        const changed = Object.fromEntries(
          (Object.keys(f) as (keyof Info)[]).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(initial[k])).map((k) => [k, f[k]]),
        );
        if (Object.keys(changed).length === 0) return;
        run(() => api(`/api/owner/venues/${venueId}`, { method: "PATCH", json: changed }), "Saved");
      }}
    >
      <label className="block text-xs text-muted">Name<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-xs text-muted">Address<input className={input} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted">
          Official cover ($, &quot;free&quot;, or blank)
          <input className={input} inputMode="decimal" value={f.officialCover} onChange={(e) => setF({ ...f, officialCover: e.target.value })} placeholder="not stated" />
        </label>
        <label className="block text-xs text-muted">Dress code<input className={input} value={f.dressCode} onChange={(e) => setF({ ...f, dressCode: e.target.value })} placeholder="None" /></label>
      </div>
      <fieldset className="rounded-xl border border-line p-2">
        <legend className="px-1 text-xs text-muted">Hours (America/New_York)</legend>
        <div className="space-y-1">
          {DAY_NAMES.map((d, day) => {
            const h = f.hours.find((x) => x.day === day);
            return (
              <div key={d} className="flex items-center gap-2 text-sm">
                <label className="flex w-14 shrink-0 items-center gap-1">
                  <input type="checkbox" checked={Boolean(h)} onChange={(e) => setDay(day, e.target.checked ? {} : null)} />
                  {d}
                </label>
                {h ? (
                  <>
                    <input type="time" className={`${input} w-0 min-w-0 flex-1 px-2 py-1`} value={h.open} onChange={(e) => setDay(day, { open: e.target.value })} aria-label={`${d} open`} />
                    <span className="text-muted">–</span>
                    <input type="time" className={`${input} w-0 min-w-0 flex-1 px-2 py-1`} value={h.close} onChange={(e) => setDay(day, { close: e.target.value })} aria-label={`${d} close`} />
                  </>
                ) : (
                  <span className="text-muted">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-xl bg-venue px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">Save official info</button>
        {note}
      </div>
    </form>
  );
}

export function OfficialPhotoForm({ venueId, currentUrl }: { venueId: string; currentUrl: string | null }) {
  const { busy, run, note } = useSubmit();
  const [file, setFile] = useState<File | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        const fd = new FormData();
        fd.set("photo", file);
        run(() => api(`/api/owner/venues/${venueId}/photo`, { method: "POST", body: fd }), "Official photo updated");
      }}
    >
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- served from our own upload route
        <img src={currentUrl} alt="Current official photo" className="h-32 w-full rounded-xl object-cover" />
      )}
      <div className="flex items-center gap-2">
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-0 min-w-0 flex-1 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-panel-2 file:px-2 file:py-1 file:text-text" />
        <button disabled={busy || !file} className="rounded-xl bg-venue px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">Upload</button>
      </div>
      <p className="text-[11px] text-muted">Shown on your page labelled &quot;From the venue&quot;, separate from people&apos;s live photos.</p>
      {note}
    </form>
  );
}

/** "YYYY-MM-DDTHH:MM" in America/New_York, whatever the device's own time zone is. */
function toNyInput(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function PromoForm({ venueId }: { venueId: string }) {
  const { busy, run, note } = useSubmit();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({ title: "", body: "", startsAt: toNyInput(new Date()), endsAt: toNyInput(new Date(Date.now() + 6 * 3600_000)) }));
  if (!open) {
    return <button onClick={() => setOpen(true)} className="rounded-xl border border-venue/60 px-3 py-1.5 text-sm text-venue">+ New promo</button>;
  }
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(
          () => api(`/api/owner/venues/${venueId}/promos`, { method: "POST", json: f }),
          "Promo created",
        );
        if (ok) setOpen(false);
      }}
    >
      <input className={input} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={3} maxLength={80} />
      <textarea className={input} placeholder="Details" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required minLength={3} maxLength={400} rows={2} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Starts (New York time)<input type="datetime-local" required className={input} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></label>
        <label className="text-xs text-muted">Ends (New York time)<input type="datetime-local" required className={input} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></label>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={busy} className="rounded-xl bg-venue px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">Create</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Cancel</button>
        {note}
      </div>
    </form>
  );
}

export function EndPromoButton({ promoId }: { promoId: string }) {
  const { busy, run } = useSubmit();
  return (
    <button disabled={busy} onClick={() => run(() => api(`/api/owner/promos/${promoId}/end`, { method: "POST" }), "Ended")} className="shrink-0 text-xs text-muted underline">
      End now
    </button>
  );
}

export function ReplyBox({ commentId }: { commentId: string }) {
  const { busy, run, note } = useSubmit();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-venue underline">Reply as venue</button>;
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api(`/api/comments/${commentId}/reply`, { method: "POST", json: { body } }), "Reply posted")) {
          setBody("");
          setOpen(false);
        }
      }}
    >
      <input className={input} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply publicly as the venue" maxLength={500} autoFocus />
      <button disabled={busy || !body.trim()} className="rounded-xl bg-venue px-3 text-sm font-semibold text-ink disabled:opacity-50">Send</button>
      {note}
    </form>
  );
}
