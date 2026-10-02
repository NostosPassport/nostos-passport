import { useMemo } from "react";

import { useFollowing } from "@/api/queries";

/** Venue slug to the display names of mutual follows going there tonight (API filters to mutuals). */
export function useFriendsByVenue(): Map<string, string[]> {
  const following = useFollowing();
  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of following.data?.following ?? []) {
      if (!f.mutual) continue;
      for (const v of f.goingTonight) {
        const list = map.get(v.slug) ?? [];
        list.push(f.displayName);
        map.set(v.slug, list);
      }
    }
    return map;
  }, [following.data]);
}
