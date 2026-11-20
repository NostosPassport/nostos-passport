/**
 * Hands a preselected place from the place page to the composer, without route params. The composer reads and
 * clears it once when it mounts.
 */
import type { Place } from "@/api/contracts";

let picked: Place | null = null;

export const placeDraft = {
  set(place: Place) {
    picked = place;
  },
  /** Returns the place once, then forgets it. */
  take(): Place | null {
    const p = picked;
    picked = null;
    return p;
  },
  clear() {
    picked = null;
  },
};
