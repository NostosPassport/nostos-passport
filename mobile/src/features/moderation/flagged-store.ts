/**
 * Content this person has reported during the session. Hidden from them right away (Guideline 1.2:
 * reported content shouldn't keep confronting the reporter); moderators decide what happens for
 * everyone else.
 */
import { useSyncExternalStore } from "react";

let ids = new Set<string>();
const listeners = new Set<() => void>();

export const flaggedStore = {
  add(id: string) {
    ids = new Set(ids).add(id);
    listeners.forEach((l) => l());
  },
  has: (id: string) => ids.has(id),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => ids,
};

export function useFlaggedIds(): Set<string> {
  return useSyncExternalStore(flaggedStore.subscribe, flaggedStore.get, flaggedStore.get);
}
