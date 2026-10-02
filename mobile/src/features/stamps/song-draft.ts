/**
 * Hands a picked song from the song picker screen back to the screen that opened it (composer or edit), without
 * route params. The opener reads and clears it when it regains focus.
 */
import type { Song } from "@/api/contracts";

let picked: { song: Song | null } | null = null;

export const songDraft = {
  /** `song: null` means "remove the song". */
  choose(song: Song | null) {
    picked = { song };
  },
  /** Returns the pick once, then forgets it. undefined = nothing was picked. */
  take(): { song: Song | null } | undefined {
    const p = picked ?? undefined;
    picked = null;
    return p;
  },
  clear() {
    picked = null;
  },
};
