import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { StampResponse, StampsPageResponse, StampView } from "@/api/contracts";
import { qk } from "@/api/keys";

/** Apply `patch` to one stamp wherever it's cached: its detail, the feed pages and every passport grid. */
export function patchStamp(queryClient: QueryClient, stampId: string, patch: (s: StampView) => StampView) {
  const page = (p: StampsPageResponse): StampsPageResponse => ({ ...p, stamps: p.stamps.map((s) => (s.id === stampId ? patch(s) : s)) });
  queryClient.setQueryData<StampResponse>(qk.stamp(stampId), (r) => (r ? { stamp: patch(r.stamp) } : r));
  for (const key of [qk.feed, ["user"]] as const) {
    queryClient.setQueriesData<InfiniteData<StampsPageResponse>>({ queryKey: key }, (d) => (d && "pages" in d ? { ...d, pages: d.pages.map(page) } : d));
  }
}

/** Drop a stamp from the feed pages and passport grids (after "Delete from profile" or a block). */
export function dropStamp(queryClient: QueryClient, stampId: string) {
  const page = (p: StampsPageResponse): StampsPageResponse => ({ ...p, stamps: p.stamps.filter((s) => s.id !== stampId) });
  queryClient.removeQueries({ queryKey: qk.stamp(stampId) });
  for (const key of [qk.feed, ["user"]] as const) {
    queryClient.setQueriesData<InfiniteData<StampsPageResponse>>({ queryKey: key }, (d) => (d && "pages" in d ? { ...d, pages: d.pages.map(page) } : d));
  }
}
