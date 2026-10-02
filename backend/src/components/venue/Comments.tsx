"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function CommentForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/venues/${venueId}/comments`, { method: "POST", json: { body } });
          setBody("");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex-1">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder="What's it like right now?"
          className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
          aria-label="Add a comment"
        />
        {error && <p className="mt-1 text-xs text-packed" role="alert">{error}</p>}
      </div>
      <button disabled={busy || !body.trim()} className="rounded-xl bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50">
        Post
      </button>
    </form>
  );
}

/** Comment text, with an inline editor for the author only (the server enforces author-only too). */
export function CommentBody({ id, body, canEdit }: { id: string; body: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [error, setError] = useState<string | null>(null);
  if (!editing) {
    return (
      <div className="mt-1 flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap break-words text-sm">{body}</p>
        {canEdit && (
          <button onClick={() => setEditing(true)} className="shrink-0 text-[11px] text-muted underline">Edit</button>
        )}
      </div>
    );
  }
  return (
    <form
      className="mt-1 space-y-1"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/api/comments/${id}`, { method: "PATCH", json: { body: draft } });
          setEditing(false);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-packed">{error}</p>}
      <div className="flex gap-2 text-xs">
        <button className="rounded-lg bg-accent px-3 py-1 font-semibold text-ink">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="text-muted">Cancel</button>
      </div>
    </form>
  );
}
