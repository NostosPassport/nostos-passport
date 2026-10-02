"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function ClaimDecision({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/claims/${claimId}`, { method: "POST", json: { approve } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="flex gap-1.5">
        <button disabled={busy} onClick={() => decide(true)} className="rounded-lg bg-chill px-2.5 py-1 text-xs font-semibold text-ink">Approve</button>
        <button disabled={busy} onClick={() => decide(false)} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted">Reject</button>
      </span>
      {error && <span className="max-w-40 text-right text-[11px] text-packed" role="alert">{error}</span>}
    </span>
  );
}

export function PaidToggle({ promoId, isPaid }: { promoId: string; isPaid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={isPaid}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            setError(null);
            try {
              await api(`/api/admin/promos/${promoId}`, { method: "PATCH", json: { isPaid: e.target.checked } });
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        Paid
      </label>
      {error && <span className="max-w-40 text-right text-[11px] text-packed" role="alert">{error}</span>}
    </span>
  );
}
