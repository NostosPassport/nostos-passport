"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type Props = { targetType: "PHOTO" | "COMMENT" | "REPORT" | "USER"; targetId: string; label?: string; className?: string };

/** Sends content to the moderation queue. Flagging never hides anything by itself (except the 3-user photo rule). */
export function FlagButton({ targetType, targetId, label = "Flag", className = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") return <span className={`text-[11px] text-muted ${className}`}>Flagged for review</span>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`text-[11px] text-muted underline decoration-dotted hover:text-warn ${className}`} aria-label={`Flag this ${targetType.toLowerCase()}`}>
        ⚑ {label}
      </button>
    );
  }
  return (
    <form
      className={`flex w-full flex-wrap items-center gap-1.5 ${className}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        setError(null);
        try {
          const res = await api<{ autoHidden: boolean }>("/api/flags", { method: "POST", json: { targetType, targetId, reason } });
          setState("done");
          if (res.autoHidden) router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setState("idle");
        }
      }}
    >
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="What's wrong? (false, abusive, not here…)"
        className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-xs outline-none focus:border-warn"
        aria-label="Reason for flagging"
      />
      <button disabled={state === "busy" || reason.trim().length < 3} className="rounded-lg bg-warn px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-50">
        Send
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">Cancel</button>
      {error && <p className="w-full text-xs text-packed">{error}</p>}
    </form>
  );
}
