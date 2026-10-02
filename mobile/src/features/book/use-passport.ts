import { useEffect } from "react";

import type { NeighborhoodIndexResponse, StampView } from "@/api/contracts";
import { useMe, useNeighborhoodIndex, usePins, useUserProfile, useUserStamps } from "@/api/queries";

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

/** Everything the book needs about your own passport. Loads every page of stamps (30 at a time) so the page count is right. */
export function usePassport(): PassportData {
  const me = useMe();
  const handle = me.data?.user.handle ?? "";
  const profile = useUserProfile(handle);
  const stamps = useUserStamps(handle, handle !== "");
  const pins = usePins();
  const index = useNeighborhoodIndex();

  useEffect(() => {
    if (stamps.hasNextPage && !stamps.isFetchingNextPage && !stamps.isFetchNextPageError) void stamps.fetchNextPage();
  }, [stamps]);

  const user = profile.data?.access === "full" ? profile.data.user : null;
  const flat = (stamps.data?.pages ?? []).flatMap((p) => p.stamps);
  const failed = me.isError || profile.isError || stamps.isError;
  const ready = !!me.data && !!user && !stamps.isPending;
  return {
    status: failed ? "error" : ready ? "ready" : "pending",
    handle,
    displayName: user?.displayName ?? me.data?.user.displayName ?? "",
    avatarUrl: user?.avatarUrl ?? null,
    bio: user?.bio ?? "",
    memberSince: user?.memberSince ?? me.data?.user.memberSince ?? "",
    stamps: flat,
    pins: pins.data?.stamps ?? [],
    counts: { stamps: user?.counts.stamps ?? flat.length, places: user?.counts.places ?? 0, neighborhoods: index.data?.totals.neighborhoodsStarted ?? 0 },
    neighborhoods: index.data?.neighborhoods ?? [],
    retry: () => {
      void me.refetch();
      void profile.refetch();
      void stamps.refetch();
    },
  };
}
