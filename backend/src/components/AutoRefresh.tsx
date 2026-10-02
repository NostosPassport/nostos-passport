"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-fetches server-rendered live data periodically and when the tab becomes visible again. */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), everyMs);
    const onVis = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, everyMs]);
  return null;
}

/**
 * Belt and braces for invariant 6 on long-open pages: a live item hides itself the moment it turns 3h old,
 * even before the next server refresh.
 */
export function ExpiresAt({ at, children }: { at: string; children: React.ReactNode }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const ms = new Date(at).getTime() - Date.now();
    const t = setTimeout(() => setExpired(true), Math.max(0, Math.min(ms, 2_147_000_000)));
    return () => clearTimeout(t);
  }, [at]);
  return expired ? null : <>{children}</>;
}
