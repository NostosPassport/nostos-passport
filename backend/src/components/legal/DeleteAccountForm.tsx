"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function DeleteAccountForm({ handle }: { handle: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <p role="status" className="rounded-xl bg-panel p-4">Your account has been deleted. You&apos;ve been signed out.</p>;
  return (
    <form
      className="space-y-3 rounded-2xl border border-packed/40 bg-panel p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/me/delete", { method: "POST", json: { password } });
          setDone(true);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm">Signed in as <b>@{handle}</b>.</p>
      <label className="block text-sm">
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
        I understand this permanently deletes my account.
      </label>
      {error && <p className="text-sm text-packed" role="alert">{error}</p>}
      <button disabled={busy || !confirmed || !password} className="rounded-xl bg-packed px-4 py-2.5 font-semibold text-ink disabled:opacity-50">
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
