"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { FlagButton } from "@/components/mod/FlagButton";

/** Block and Report controls for someone else's profile (App Store Guideline 1.2). */
export function BlockReport({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Block @${handle}? You won't see each other's photos, comments or profiles, and follows between you are removed.`)) return;
          setBusy(true);
          setError(null);
          try {
            await api(`/api/users/${handle}/block`, { method: "POST" });
            router.push("/people");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
        className="rounded-full border border-packed/60 px-3 py-1.5 text-packed"
      >
        Block
      </button>
      <FlagButton targetType="USER" targetId={handle} label="Report account" />
      {error && <span className="text-xs text-packed">{error}</span>}
    </div>
  );
}

/** Unblock from the block list, by the block's opaque ref (blocks made from Anonymous content have no handle). */
export function UnblockButton({ blockRef }: { blockRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/me/blocks/${blockRef}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted"
    >
      Unblock
    </button>
  );
}
