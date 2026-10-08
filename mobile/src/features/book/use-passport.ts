import { useEffect } from "react";

import type { NeighborhoodIndexResponse, StampView } from "@/api/contracts";
import { useMe, useNeighborhoodIndex, usePins, useUserStamps } from "@/api/queries";

export type PassportData = {
  status: "pending" | "error" | "ready";
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  memberSince: string;
  stamps: StampView[];
  pins: StampView[];
  counts: { stamps: number; places: number; neighborhoods: number };
  neighborhoods: NeighborhoodIndexResponse["neighborhoods"];
  retry: () => void;
};

export function usePassport(): PassportData {
  const me = useMe();
  const handle = me.data?.user.handle ?? "";
  const stamps = useUserStamps(handle, handle !== "");
  const pins = usePins();
  const index = useNeighborhoodIndex();

  useEffect(() => {
    if (stamps.hasNextPage && !stamps.isFetchingNextPage && !stamps.isFetchNextPageError) void stamps.fetchNextPage();
  }, [stamps]);

  const flat = (stamps.data?.pages ?? []).flatMap((p) => p.stamps);
  const uniquePlaces = new Set(flat.map((stamp) => stamp.place.id)).size;
  const failed = me.isError || stamps.isError;
  const ready = !!me.data && !stamps.isPending;
  return {
    status: failed ? "error" : ready ? "ready" : "pending",
    handle,
    displayName: me.data?.user.displayName ?? "",
    avatarUrl: me.data?.user.avatarUrl ?? null,
    bio: me.data?.user.bio ?? "",
    memberSince: me.data?.user.memberSince ?? "",
    stamps: flat,
    pins: pins.data?.stamps ?? [],
    counts: { stamps: flat.length, places: uniquePlaces, neighborhoods: index.data?.totals.neighborhoodsStarted ?? 0 },
    neighborhoods: index.data?.neighborhoods ?? [],
    retry: () => {
      void me.refetch();
      void stamps.refetch();
      void pins.refetch();
      void index.refetch();
    },
  };
}
