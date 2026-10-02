"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const form: Record<string, unknown> = Object.fromEntries(fd);
    if (mode === "signup") {
      form.acceptTerms = fd.get("acceptTerms") === "on";
      form.confirm21 = fd.get("confirm21") === "on";
    }
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: form });
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
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode === "signup" && (
        <>
          <input name="displayName" placeholder="Display name" required className={input} autoComplete="name" />
          <input name="handle" placeholder="handle (letters, numbers, _)" required className={input} autoCapitalize="none" />
        </>
      )}
      <input name="email" type="email" placeholder="Email" required className={input} autoComplete="email" />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        minLength={mode === "signup" ? 10 : undefined}
        className={input}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />
      {mode === "signup" && (
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm21" required className="mt-1" />
            <span>I&apos;m 21 or older</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="acceptTerms" required className="mt-1" />
            <span>
              I agree to the <Link href="/terms" className="text-accent underline" target="_blank">Terms</Link> and{" "}
              <Link href="/privacy" className="text-accent underline" target="_blank">Privacy Policy</Link>, including zero tolerance for abusive content
            </span>
          </label>
        </div>
      )}
      {error && <p className="rounded-lg bg-packed/15 px-3 py-2 text-sm text-packed" role="alert">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-ink disabled:opacity-60">
        {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
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
