"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FollowButton } from "./FollowButton";

type Result = { handle: string; displayName: string | null; verified: boolean; follow: "none" | "requested" | "following"; isSelf: boolean };

export function PeopleSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api<{ users: Result[] }>(`/api/users?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setResults(res.users);
      } catch {
        /* aborted or failed; keep previous results */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people by name or @handle"
        className="w-full rounded-xl border border-line bg-panel-2 px-3 py-3 outline-none focus:border-accent"
        aria-label="Search people"
        autoCapitalize="none"
      />
      {loading && <p className="mt-2 text-xs text-muted">Searching…</p>}
      {results && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-panel">
          {results.length === 0 && <li className="p-3 text-sm text-muted">No one found.</li>}
          {results.map((r) => (
            <li key={r.handle} className="flex items-center justify-between gap-2 px-3 py-2">
              <Link href={`/u/${r.handle}`} className="min-w-0">
                <div className="truncate font-medium">{r.displayName ?? `@${r.handle}`}</div>
                <div className="text-xs text-muted">@{r.handle}{r.verified && " ✓"}</div>
              </Link>
              {!r.isSelf && <FollowButton handle={r.handle} initial={r.follow} small />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
