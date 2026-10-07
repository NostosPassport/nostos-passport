"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type Challenge = { challengeId: string; expiresAt: string; resendAfterSeconds: number };

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState("");

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = mode === "signup" ? { email, displayName, handle, birthdate, acceptTerms } : { email };
      const next = await api<Challenge>(`/api/auth/${mode === "signup" ? "signup" : "login"}/start`, { method: "POST", json: body });
      setChallenge(next);
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const body = mode === "signup"
        ? { challengeId: challenge.challengeId, code, displayName, handle, acceptTerms: true }
        : { challengeId: challenge.challengeId, code };
      await api(`/api/auth/${mode}`, { method: "POST", json: body });
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-line bg-panel-2 px-3 py-3 text-base outline-none focus:border-accent";
  const button = "w-full rounded-xl bg-accent py-3 font-semibold text-ink disabled:opacity-60";

  if (challenge) {
    return (
      <form onSubmit={verifyCode} className="space-y-3">
        <p className="text-sm text-muted">We sent a six-digit code to <strong>{email}</strong>.</p>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          pattern="[0-9]{6}"
          className={input}
          autoFocus
        />
        {error && <p className="rounded-lg bg-packed/15 px-3 py-2 text-sm text-packed" role="alert">{error}</p>}
        <button disabled={busy || code.length !== 6} className={button}>{busy ? "…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <button
          type="button"
          className="w-full py-2 text-sm text-accent"
          onClick={() => {
            setChallenge(null);
            setCode("");
            setError(null);
          }}
        >
          Change email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-3">
      {mode === "signup" && (
        <>
          <input name="displayName" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className={input} autoComplete="name" />
          <input name="handle" placeholder="handle (letters, numbers, ., _)" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} required className={input} autoCapitalize="none" />
        </>
      )}
      <input name="email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} autoComplete="email" />
      {mode === "signup" && (
        <div className="space-y-2 text-sm">
          <label className="block space-y-1">
            <span>Date of birth. Nostos is for people 13 and older. We check it once and don&apos;t keep it.</span>
            <input name="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required className={input} autoComplete="bday" />
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="acceptTerms" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required className="mt-1" />
            <span>
              I agree to the <Link href="/terms" className="text-accent underline" target="_blank">Terms</Link> and{" "}
              <Link href="/privacy" className="text-accent underline" target="_blank">Privacy Policy</Link>, including zero tolerance for abusive content
            </span>
          </label>
        </div>
      )}
      {error && <p className="rounded-lg bg-packed/15 px-3 py-2 text-sm text-packed" role="alert">{error}</p>}
      <button disabled={busy || (mode === "signup" && !acceptTerms)} className={button}>{busy ? "…" : "Email me a code"}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link className="text-accent" href="/signup">Create an account</Link></>
        ) : (
          <>Have an account? <Link className="text-accent" href="/login">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
