/** Hands a fresh stamp from the composer to the landing screen without route params (a stamp is too big for a URL). */
import type { NeighborhoodProgress, StampView } from "@/api/contracts";

let landed: { stamp: StampView; progress: NeighborhoodProgress | null } | null = null;

export const landingDraft = {
  set(stamp: StampView, progress: NeighborhoodProgress | null) {
    landed = { stamp, progress };
  },
  /** Read without clearing, so the screen can re-render. */
  peek: () => landed,
  clear() {
    landed = null;
  },
};
