"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type FollowState = "none" | "requested" | "following";

/** Follow (public: instant; private: sends a request), Requested (tap to cancel), Following (tap to unfollow). */
export function FollowButton({ handle, initial, small }: { handle: string; initial: FollowState; small?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FollowState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = state === "following" ? "Following" : state === "requested" ? "Requested" : "Follow";
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <button
        disabled={busy}
        aria-pressed={state !== "none"}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await api<{ state: FollowState }>(`/api/users/${handle}/follow`, { method: state === "none" ? "PUT" : "DELETE" });
            setState(res.state);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className={`rounded-full font-semibold transition active:scale-95 disabled:opacity-50 ${small ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"} ${state !== "none" ? "border border-line text-muted" : "bg-accent text-ink"}`}
      >
        {label}
      </button>
      {error && <span className="max-w-48 text-right text-[11px] text-packed" role="alert">{error}</span>}
    </span>
  );
}
