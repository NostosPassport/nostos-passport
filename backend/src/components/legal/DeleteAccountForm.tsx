"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type Challenge = { challengeId: string; expiresAt: string; resendAfterSeconds: number };

export function DeleteAccountForm({ handle }: { handle: string }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const next = await api<Challenge>("/api/me/delete/start", { method: "POST", json: {} });
      setChallenge(next);
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/delete", { method: "POST", json: { challengeId: challenge.challengeId, code } });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p role="status" className="rounded-xl bg-panel p-4">Your account has been deleted. You&apos;ve been signed out.</p>;

  if (!challenge) {
    return (
      <div className="space-y-3 rounded-2xl border border-packed/40 bg-panel p-4">
        <p className="text-sm">Signed in as <b>@{handle}</b>.</p>
        <p className="text-sm text-muted">We&apos;ll send a six-digit confirmation code to the email on your account.</p>
        {error && <p className="text-sm text-packed" role="alert">{error}</p>}
        <button type="button" onClick={sendCode} disabled={busy} className="rounded-xl bg-packed px-4 py-2.5 font-semibold text-ink disabled:opacity-50">
          {busy ? "Sending…" : "Email confirmation code"}
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3 rounded-2xl border border-packed/40 bg-panel p-4" onSubmit={removeAccount}>
      <p className="text-sm">Signed in as <b>@{handle}</b>.</p>
      <label className="block text-sm">
        Verification code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          required
          pattern="[0-9]{6}"
          className="mt-1 w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
        I understand this permanently deletes my account.
      </label>
      {error && <p className="text-sm text-packed" role="alert">{error}</p>}
      <button disabled={busy || !confirmed || code.length !== 6} className="rounded-xl bg-packed px-4 py-2.5 font-semibold text-ink disabled:opacity-50">
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
