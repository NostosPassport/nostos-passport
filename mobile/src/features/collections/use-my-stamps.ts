import { useEffect } from "react";

import type { StampView } from "@/api/contracts";
import { useMe, useUserStamps } from "@/api/queries";

export function useMyStamps(): {
  stamps: StampView[];
  pending: boolean;
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
    pending: me.isPending || query.isPending || query.hasNextPage,
    error: me.isError || query.isError,
    retry: () => {
      void me.refetch();
      void query.refetch();
    },
  };
}
