/**
 * The photos for the stamp being made, shared between the composer and the in-app camera. Photos come from the camera only:
 * a stamp's photos are proof you were there, so there is no way to add one from the library.
 */
import { useSyncExternalStore } from "react";

import { addPhoto, removePhotoAt } from "./stamp-flow";

let uris: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const photoDraft = {
  get: (): readonly string[] => uris,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Adds a photo; false when there are already six. */
  add(uri: string): boolean {
    const next = addPhoto(uris, uri);
    if (next.length === uris.length) return false;
    uris = next;
    emit();
    return true;
  },
  remove(index: number) {
    uris = removePhotoAt(uris, index);
    emit();
  },
  clear() {
    if (uris.length === 0) return;
    uris = [];
    emit();
  },
};

export const usePhotoDraft = (): readonly string[] => useSyncExternalStore(photoDraft.subscribe, photoDraft.get, photoDraft.get);
