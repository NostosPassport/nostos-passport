/** Hands a fresh stamp from the composer to the landing screen without route params (a stamp is too big for a URL). */
import type { StampView } from "@/api/contracts";

let landed: { stamp: StampView } | null = null;

export const landingDraft = {
  set(stamp: StampView) {
    landed = { stamp };
  },
  peek: () => landed,
  clear() {
    landed = null;
  },
};
