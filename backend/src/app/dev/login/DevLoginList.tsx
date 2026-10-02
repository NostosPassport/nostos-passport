"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type U = { email: string; handle: string; displayName: string; role: string; reputation: number; createdAt: string };

const ROLE_ORDER = ["ADMIN", "MODERATOR", "USER"];

export function DevLoginList({ users, password }: { users: U[]; password: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string) {
    setBusy(email);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-5">
      {error && <p className="text-sm text-packed">{error}</p>}
      {ROLE_ORDER.map((role) => {
        const group = users.filter((u) => u.role === role);
        if (!group.length) return null;
        return (
          <section key={role}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{role.replace("_", " ")}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {group.map((u) => (
                <li key={u.email}>
                  <button
                    onClick={() => signIn(u.email)}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-panel-2 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.displayName} <span className="text-muted">@{u.handle}</span></span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      rep {u.reputation.toFixed(2)}
                      <br />
                      {Math.round((Date.now() - new Date(u.createdAt).getTime()) / 86_400_000)}d old
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
