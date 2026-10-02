/**
 * Photo uploads that outlive the composer: the composer hands the photo here and closes, and the
 * venue screen shows an optimistic tile with progress that turns into the real photo.
 */
import { useSyncExternalStore } from "react";

import { api, ApiError, errorText } from "@/api";
import { PhotoResponse } from "@/api/contracts";
import type { Coords } from "@/lib/geo";

export type PendingUpload = {
  localId: string;
  venueId: string;
  uri: string;
  caption: string;
  progress: number;
  status: "uploading" | "failed" | "done";
  error: string | null;
  /** The server's photo once posted; the tile shows it until the venue page refetches. */
  result: { id: string; url: string } | null;
};

/** A post adds a rating (1-10) and whether it's shared to the venue page. Without one it's a live-only photo. */
export type PostFields = { rating: number; shared: boolean };
type Input = { venueId: string; uri: string; caption: string; coords: Coords; post?: PostFields | null };

/** The multipart text fields for an upload (the server reads "1".."10" and "true"/"false"). */
export function uploadFields(input: Pick<Input, "caption" | "coords" | "post">): [string, string][] {
  const fields: [string, string][] = [
    ["caption", input.caption],
    ["lat", String(input.coords.lat)],
    ["lng", String(input.coords.lng)],
  ];
  if (input.post) fields.push(["rating", String(input.post.rating)], ["shared", input.post.shared ? "true" : "false"]);
  return fields;
}

/** A posted tile that never shows up in the refetched page (auto-hidden, venue closed) goes after this. */
export const DONE_TTL_MS = 2 * 60_000;

let uploads: PendingUpload[] = [];
const inputs = new Map<string, { input: Input; events: UploadEvents }>();
const controllers = new Map<string, AbortController>();
const expiries = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

function patch(localId: string, p: Partial<PendingUpload>) {
  uploads = uploads.map((u) => (u.localId === localId ? { ...u, ...p } : u));
  emit();
}

export type UploadEvents = { onSuccess?: (u: PendingUpload) => void; onError?: (e: ApiError) => void };

function run(localId: string) {
  const entry = inputs.get(localId);
  // Already sending (two Retry taps in one frame): don't post twice.
  if (!entry || controllers.has(localId)) return;
  const { input, events } = entry;
  const form = new FormData();
  // React Native's FormData takes a file descriptor object for local files.
  form.append("photo", { uri: input.uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  for (const [k, v] of uploadFields(input)) form.append(k, v);
  const controller = new AbortController();
  controllers.set(localId, controller);
  patch(localId, { status: "uploading", progress: 0, error: null });

  api
    .upload(`/api/venues/${encodeURIComponent(input.venueId)}/photos`, PhotoResponse, form, {
      onProgress: (progress) => patch(localId, { progress }),
      signal: controller.signal,
    })
    .then((res) => {
      patch(localId, { status: "done", progress: 1, result: { id: res.photo.id, url: res.photo.url } });
      events.onSuccess?.(uploads.find((u) => u.localId === localId)!);
      expiries.set(
        localId,
        setTimeout(() => uploadStore.remove(localId), DONE_TTL_MS),
      );
    })
    .catch((e: unknown) => {
      const err = e instanceof ApiError ? e : new ApiError(0, "offline", "Upload failed.");
      if (err.code === "cancelled") return;
      patch(localId, { status: "failed", error: errorText(err, "Couldn't upload that photo. Try again.") });
      events.onError?.(err);
    })
    .finally(() => controllers.delete(localId));
}

export const uploadStore = {
  start(input: Input, events: UploadEvents = {}): string {
    const localId = `local-${Date.now()}-${++seq}`;
    inputs.set(localId, { input, events });
    uploads = [
      { localId, venueId: input.venueId, uri: input.uri, caption: input.caption, progress: 0, status: "uploading", error: null, result: null },
      ...uploads,
    ];
    emit();
    run(localId);
    return localId;
  },
  /** Retry with the same callbacks as the original post (toast, refetch, cooldown, presence). */
  retry(localId: string) {
    run(localId);
  },
  remove(localId: string) {
    if (!inputs.has(localId) && !uploads.some((u) => u.localId === localId)) return;
    controllers.get(localId)?.abort();
    clearTimeout(expiries.get(localId));
    expiries.delete(localId);
    inputs.delete(localId);
    uploads = uploads.filter((u) => u.localId !== localId);
    emit();
  },
  /** Once the refetched page contains the photo, drop the optimistic copy. */
  settle(venueId: string, serverIds: Set<string>) {
    const next = uploads.filter((u) => !(u.venueId === venueId && u.status === "done" && u.result && serverIds.has(u.result.id)));
    if (next.length !== uploads.length) {
      for (const u of uploads) {
        if (next.includes(u)) continue;
        inputs.delete(u.localId);
        clearTimeout(expiries.get(u.localId));
        expiries.delete(u.localId);
      }
      uploads = next;
      emit();
    }
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => uploads,
};

export function useUploads(venueId: string): PendingUpload[] {
  const all = useSyncExternalStore(uploadStore.subscribe, uploadStore.get, uploadStore.get);
  return all.filter((u) => u.venueId === venueId);
}
