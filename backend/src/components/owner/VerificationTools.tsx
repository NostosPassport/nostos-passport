"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Row = { handle: string; displayName: string; email: string; role: string; isPrivate: boolean; verified: boolean; suspended: boolean };
type LogEvent = { id: string; handle: string; action: "GRANT" | "REVOKE"; note: string; by: string; at: string };

/**
 * Admin verification tools: search accounts, grant or revoke the verified badge with a required note. Every change
 * is logged (append-only). The badge changes nothing but the badge.
 */
export function VerificationTools() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadLog = () => api<{ events: LogEvent[] }>("/api/admin/verification-log").then((r) => setLog(r.events)).catch(() => {});
  useEffect(() => {
    void loadLog();
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) return setRows([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ users: Row[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((r) => setRows(r.users)).catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const decide = async (r: Row) => {
    const note = (notes[r.handle] ?? "").trim();
    if (note.length < 3) return setError(`Add a note for @${r.handle} (why you're ${r.verified ? "revoking" : "granting"} it).`);
    setBusy(r.handle);
    setError(null);
    try {
      const res = await api<{ user: { verified: boolean } }>(`/api/admin/users/${encodeURIComponent(r.handle)}/verification`, { method: "POST", json: { verified: !r.verified, note } });
      setRows((all) => all.map((x) => (x.handle === r.handle ? { ...x, verified: res.user.verified } : x)));
      setNotes((n) => ({ ...n, [r.handle]: "" }));
      void loadLog();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by handle, name or email"
        className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
        aria-label="Search accounts"
        autoCapitalize="none"
      />
      {error && <p className="text-xs text-packed" role="alert">{error}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.handle} className="rounded-2xl bg-panel px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-medium">@{r.handle}</span>
                {r.verified && <span className="ml-1.5 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase">Verified</span>}
                <span className="block truncate text-xs text-muted">
                  {r.displayName} · {r.email} · {r.role.toLowerCase()}{r.isPrivate ? " · private" : ""}{r.suspended ? " · suspended" : ""}
                </span>
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={notes[r.handle] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.handle]: e.target.value }))}
                placeholder={r.verified ? "Why revoke? (required)" : "Why verify? (required)"}
                maxLength={300}
                className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
                aria-label={`Note for @${r.handle}`}
              />
              <button
                disabled={busy === r.handle}
                onClick={() => decide(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${r.verified ? "border border-line text-muted" : "bg-accent text-ink"}`}
              >
                {r.verified ? "Revoke" : "Verify"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {log.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Log</h3>
          <ul className="divide-y divide-line rounded-2xl bg-panel text-xs">
            {log.slice(0, 20).map((e) => (
              <li key={e.id} className="px-3 py-2">
                <span className="font-medium">{e.action === "GRANT" ? "Verified" : "Revoked"} @{e.handle}</span>
                <span className="text-muted"> by {e.by === "system" ? "system" : `@${e.by}`} · {new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</span>
                <span className="block text-muted">{e.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
