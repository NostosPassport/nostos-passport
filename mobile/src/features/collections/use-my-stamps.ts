import { useEffect } from "react";

import type { StampView } from "@/api/contracts";
import { useMe, useUserStamps } from "@/api/queries";

/**
 * Every stamp in the master Passport. Later pages load one after another in the background: `pending` covers only
 * the first page, and `loadingMore` the rest, so the editor can show what has loaded right away (P-132).
 */
export function useMyStamps(): {
  stamps: StampView[];
  pending: boolean;
  loadingMore: boolean;
  error: boolean;
  retry: () => void;
} {
  const me = useMe();
  const handle = me.data?.user.handle ?? "";
  const query = useUserStamps(handle, handle !== "");

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) void query.fetchNextPage();
  }, [query]);

  return {
    stamps: (query.data?.pages ?? []).flatMap((page) => page.stamps),
    pending: me.isPending || query.isPending,
    loadingMore: !query.isPending && !!query.hasNextPage && !query.isFetchNextPageError,
    error: me.isError || query.isError,
    retry: () => {
      void me.refetch();
      if (query.isFetchNextPageError) void query.fetchNextPage();
      else void query.refetch();
    },
  };
}
