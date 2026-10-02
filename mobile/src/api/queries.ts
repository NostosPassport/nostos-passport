/** Query keys and shared hooks for server state. */
import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";

import type { VenuePageResponse } from "./contracts";

import { api } from "./index";
import { qk } from "./keys";
import { useAuth } from "@/auth/auth-context";

export { qk };

export function useMe() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.me, queryFn: () => api.me.get(), enabled: status === "signedIn", staleTime: 60_000 });
}

export function useVenues() {
  return useQuery({ queryKey: qk.venues, queryFn: api.venues.list, refetchInterval: 60_000 });
}

export function useFollowing() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.following, queryFn: api.me.following, enabled: status === "signedIn", staleTime: 60_000, refetchInterval: 60_000 });
}

/** Venue page; refetched every 60 s while the screen is mounted (it's only mounted while open). */
export function useVenue(idOrSlug: string, enabled = true) {
  return useQuery({ queryKey: qk.venue(idOrSlug), queryFn: () => api.venues.get(idOrSlug), refetchInterval: 60_000, enabled });
}

/**
 * Refetch a venue page however it was opened (by id or by slug), plus the map.
 * Cache keys are the route param, so match on the loaded page's id too.
 */
export function invalidateVenue(queryClient: QueryClient, venueId: string) {
  return Promise.all([
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === "venue" && (q.queryKey[1] === venueId || (q.state.data as VenuePageResponse | undefined)?.official.id === venueId),
    }),
    queryClient.invalidateQueries({ queryKey: qk.venues }),
  ]);
}

export function useUserProfile(handle: string) {
  return useQuery({ queryKey: qk.user(handle), queryFn: () => api.users.get(handle) });
}

/** A profile's Posts grid, 30 per page. Pages come from the server's opaque `nextBefore` cursor. */
export function useUserPosts(handle: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.userPosts(handle),
    queryFn: ({ pageParam }) => api.users.posts(handle, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
  });
}

export function useUserPlaces(handle: string, enabled = true) {
  return useQuery({ queryKey: qk.userPlaces(handle), queryFn: () => api.users.places(handle), enabled });
}

/** Followers or following of a profile you have full access to. */
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

export function usePost(id: string) {
  return useQuery({ queryKey: qk.post(id), queryFn: () => api.posts.get(id) });
}

/** One month's featured gallery for a venue (`month` = YYYY-MM). */
export function useFeaturedMonth(venueId: string, month: string, enabled = true) {
  return useQuery({ queryKey: qk.featuredMonth(venueId, month), queryFn: () => api.venues.featured(venueId, month), enabled });
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

export function useBlocks() {
  return useQuery({ queryKey: qk.blocks, queryFn: api.me.blocks });
}

export function useOwnerDashboard(venueId: string) {
  return useQuery({ queryKey: qk.ownerDashboard(venueId), queryFn: () => api.owner.dashboard(venueId), refetchInterval: 60_000 });
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
