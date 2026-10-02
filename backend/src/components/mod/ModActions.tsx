"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type Props = { targetType: "STAMP" | "USER"; targetId: string; hidden: boolean };

export function ModActions({ targetType, targetId, hidden }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: "HIDE" | "DISMISS" | "RESTORE" | "SUSPEND" | "UNSUSPEND") => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/mod/actions", { method: "POST", json: { targetType, targetId, action, note: note || undefined } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the log (optional)" className="w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-xs" aria-label="Moderator note" />
      {targetType === "USER" ? (
        <div className="flex flex-wrap gap-1.5">
          {hidden ? (
            <button disabled={busy} onClick={() => act("UNSUSPEND")} className="rounded-lg border border-chill/60 px-3 py-1.5 text-xs text-chill">Unsuspend</button>
          ) : (
            <button disabled={busy} onClick={() => confirm("Suspend this account? They'll be signed out everywhere and can't sign in.") && act("SUSPEND")} className="rounded-lg bg-packed px-3 py-1.5 text-xs font-semibold text-ink">Suspend account</button>
          )}
          <button disabled={busy} onClick={() => act("DISMISS")} className="rounded-lg border border-line px-3 py-1.5 text-xs">Dismiss reports</button>
        </div>
      ) : (
      <div className="flex flex-wrap gap-1.5">
        {!hidden && (
          <button disabled={busy} onClick={() => act("HIDE")} className="rounded-lg bg-packed px-3 py-1.5 text-xs font-semibold text-ink">Hide</button>
        )}
        <button disabled={busy} onClick={() => act("DISMISS")} className="rounded-lg border border-line px-3 py-1.5 text-xs">
          {hidden ? "Dismiss flags (undoes auto-hide)" : "Dismiss flags"}
        </button>
        {hidden && (
          <>
            <button disabled={busy} onClick={() => act("HIDE")} className="rounded-lg bg-packed px-3 py-1.5 text-xs font-semibold text-ink">Keep hidden</button>
            <button disabled={busy} onClick={() => act("RESTORE")} className="rounded-lg border border-chill/60 px-3 py-1.5 text-xs text-chill">Restore</button>
          </>
        )}
      </div>
      )}
      {error && <p className="text-xs text-packed">{error}</p>}
    </div>
  );
}
