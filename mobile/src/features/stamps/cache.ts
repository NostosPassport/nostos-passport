import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { StampResponse, StampView, UserStampsResponse } from "@/api/contracts";
import { qk } from "@/api/keys";
import { pageAndSlot } from "@/lib/layout";

export function patchStamp(queryClient: QueryClient, stampId: string, patch: (s: StampView) => StampView) {
  const page = (p: UserStampsResponse): UserStampsResponse => ({ ...p, stamps: p.stamps.map((s) => (s.id === stampId ? patch(s) : s)) });
  queryClient.setQueryData<StampResponse>(qk.stamp(stampId), (r) => (r ? { stamp: patch(r.stamp) } : r));
  queryClient.setQueriesData<InfiniteData<UserStampsResponse>>({ queryKey: ["user"] }, (d) => (d && "pages" in d ? { ...d, pages: d.pages.map(page) } : d));
}

export function dropStamp(queryClient: QueryClient, stampId: string) {
  queryClient.removeQueries({ queryKey: qk.stamp(stampId) });
  queryClient.setQueriesData<InfiniteData<UserStampsResponse>>({ queryKey: ["user"] }, (d) => {
    if (!d || !("pages" in d)) return d;
    let ordinal = 0;
    return {
      ...d,
      pages: d.pages.map((page) => ({
        ...page,
        stamps: page.stamps
          .filter((stamp) => stamp.id !== stampId)
          .map((stamp) => ({ ...stamp, ...pageAndSlot(ordinal++) })),
      })),
    };
  });
}
