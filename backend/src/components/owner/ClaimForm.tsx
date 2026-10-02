"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function ClaimForm({ venues }: { venues: { id: string; name: string }[] }) {
  const router = useRouter();
  const [venueId, setVenueId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/claims", { method: "POST", json: { venueId } });
          setMsg("Claim sent. An admin will review it.");
          router.refresh();
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}
    >
      <select value={venueId} onChange={(e) => setVenueId(e.target.value)} required className="flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm" aria-label="Venue">
        <option value="">Choose a venue…</option>
        {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <button className="rounded-xl bg-venue px-4 text-sm font-semibold text-ink">Claim</button>
      {msg && <p className="basis-full text-xs text-muted">{msg}</p>}
    </form>
  );
}
