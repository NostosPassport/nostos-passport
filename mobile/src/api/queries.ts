/** Query keys and shared hooks for server state. */
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "./index";
import { qk } from "./keys";
import { useAuth } from "@/auth/auth-context";

export { qk };

export function useMe() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.me, queryFn: () => api.me.get(), enabled: status === "signedIn", staleTime: 60_000 });
}

export function usePlaces() {
  return useQuery({ queryKey: qk.places, queryFn: api.places.list, staleTime: 5 * 60_000 });
}

/** Places inside or near the geofence of a position, nearest first. The position is rounded so a few steps don't refetch. */
export function useNearbyPlaces(pos: { lat: number; lng: number } | null) {
  const lat = pos ? Math.round(pos.lat * 10_000) / 10_000 : 0;
  const lng = pos ? Math.round(pos.lng * 10_000) / 10_000 : 0;
  return useQuery({ queryKey: qk.nearby(lat, lng), queryFn: () => api.places.nearby({ lat, lng }), enabled: pos !== null, staleTime: 30_000 });
}

/** Home feed: people you follow, newest first, 30 per page. Pages come from the server's opaque `nextBefore` cursor. */
export function useFeed() {
  const { status } = useAuth();
  return useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) => api.feed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled: status === "signedIn",
  });
}

export function useFollowing() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.following, queryFn: api.me.following, enabled: status === "signedIn", staleTime: 60_000, refetchInterval: 60_000 });
}

export function useUserProfile(handle: string) {
  return useQuery({ queryKey: qk.user(handle), queryFn: () => api.users.get(handle) });
}

/** A passport's Stamps grid, 30 per page. */
export function useUserStamps(handle: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.userStamps(handle),
    queryFn: ({ pageParam }) => api.users.stamps(handle, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
  });
}

export function useUserPlaces(handle: string, enabled = true) {
  return useQuery({ queryKey: qk.userPlaces(handle), queryFn: () => api.users.places(handle), enabled });
}

/** Followers or following of a passport you have full access to. */
export function usePeopleList(handle: string, list: "followers" | "following") {
  return useQuery({ queryKey: qk.people(handle, list), queryFn: () => api.users.people(handle, list) });
}

export function useProfileSettings() {
  return useQuery({ queryKey: qk.profileSettings, queryFn: api.me.profile });
}

export function useFollowRequests() {
  return useQuery({ queryKey: qk.followRequests, queryFn: api.me.followRequests });
}

export function useActivity() {
  return useQuery({ queryKey: qk.activity, queryFn: api.me.activity });
}

export function useStamp(id: string) {
  return useQuery({ queryKey: qk.stamp(id), queryFn: () => api.stamps.get(id) });
}

export function useUserSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: qk.userSearch(query),
    queryFn: () => api.users.search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
    // Keep the last results on screen while the next query loads (no skeleton flash per keystroke).
    placeholderData: keepPreviousData,
  });
}

export function useSongSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: qk.songSearch(query),
    queryFn: () => api.songs.search(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useBlocks() {
  return useQuery({ queryKey: qk.blocks, queryFn: api.me.blocks });
}

export function useModQueue() {
  return useQuery({ queryKey: qk.modQueue, queryFn: api.mod.queue, refetchInterval: 60_000 });
}

export function useModHidden(enabled: boolean) {
  return useQuery({ queryKey: qk.modHidden, queryFn: api.mod.hidden, enabled });
}

export function useModLog(enabled: boolean) {
  return useQuery({ queryKey: qk.modLog, queryFn: api.mod.log, enabled });
}
