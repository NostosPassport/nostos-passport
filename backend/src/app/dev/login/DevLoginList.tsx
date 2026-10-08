"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type U = { email: string; handle: string; displayName: string; createdAt: string };

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
    <div className="mt-4 space-y-3">
      {error && <p className="text-sm text-packed">{error}</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {users.map((u) => (
          <li key={u.email}>
            <button onClick={() => signIn(u.email)} disabled={busy !== null} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-panel-2 disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.displayName} <span className="text-muted">@{u.handle}</span></span>
                <span className="block truncate text-xs text-muted">{u.email}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{Math.round((Date.now() - new Date(u.createdAt).getTime()) / 86_400_000)}d old</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
