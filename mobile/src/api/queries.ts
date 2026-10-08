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

export function useNearbyPlaces(pos: { lat: number; lng: number } | null) {
  const lat = pos ? Math.round(pos.lat * 10_000) / 10_000 : 0;
  const lng = pos ? Math.round(pos.lng * 10_000) / 10_000 : 0;
  return useQuery({ queryKey: qk.nearby(lat, lng), queryFn: () => api.places.nearby({ lat, lng }), enabled: pos !== null, staleTime: 30_000 });
}

export function useUserStamps(handle: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.userStamps(handle),
    queryFn: ({ pageParam }) => api.users.stamps(handle, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextAfter,
    enabled,
  });
}

export function useUserPlaces(handle: string, enabled = true) {
  return useQuery({ queryKey: qk.userPlaces(handle), queryFn: () => api.users.places(handle), enabled });
}

export function usePlacePage(id: string, pos: { lat: number; lng: number } | null) {
  const { status } = useAuth();
  const lat = pos ? Math.round(pos.lat * 10_000) / 10_000 : null;
  const lng = pos ? Math.round(pos.lng * 10_000) / 10_000 : null;
  return useQuery({
    queryKey: qk.placePage(id, lat, lng),
    queryFn: () => api.places.mine(id, lat !== null && lng !== null ? { lat, lng } : undefined),
    enabled: status === "signedIn" && id !== "",
    staleTime: 30_000,
  });
}

export function usePins() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.pins, queryFn: () => api.pins.get(), enabled: status === "signedIn", staleTime: 60_000 });
}

export function useNeighborhoodIndex() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.neighborhoods, queryFn: () => api.neighborhoods(), enabled: status === "signedIn", staleTime: 60_000 });
}

export function useProfileSettings() {
  return useQuery({ queryKey: qk.profileSettings, queryFn: api.me.profile });
}

export function useStamp(id: string) {
  return useQuery({ queryKey: qk.stamp(id), queryFn: () => api.stamps.get(id) });
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
