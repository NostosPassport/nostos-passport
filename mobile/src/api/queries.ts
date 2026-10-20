/** Query keys and shared hooks for server state. */
import { useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "./index";
import { qk } from "./keys";
import { useAuth } from "@/auth/auth-context";

export { qk };

export function useMe() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.me, queryFn: () => api.me.get(), enabled: status === "signedIn", staleTime: 60_000 });
}

/** Stored Nostos venues only. Kept for historical/admin-compatible surfaces; discovery should use nearby/search. */
export function usePlaces() {
  return useQuery({ queryKey: qk.places, queryFn: api.places.list, staleTime: 5 * 60_000 });
}

export function useNearbyPlaces(pos: { lat: number; lng: number } | null, radiusM = 750, precision = 4) {
  const factor = 10 ** Math.max(2, Math.min(5, precision));
  const lat = pos ? Math.round(pos.lat * factor) / factor : 0;
  const lng = pos ? Math.round(pos.lng * factor) / factor : 0;
  const radius = Math.max(100, Math.min(5_000, Math.round(radiusM / 50) * 50));
  return useQuery({
    queryKey: qk.nearby(lat, lng, radius),
    queryFn: () => api.places.nearby({ lat, lng }, radius),
    enabled: pos !== null,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

function useDebouncedText(raw: string, delayMs = 350) {
  const next = raw.trim();
  const [value, setValue] = useState(next);
  useEffect(() => {
    const timer = setTimeout(() => setValue(next), next.length === 0 ? 0 : delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, next]);
  return value;
}

export function usePlaceSearch(rawQuery: string, _pos: { lat: number; lng: number } | null) {
  const q = useDebouncedText(rawQuery);
  return useQuery({
    queryKey: qk.placeSearch(q, null, null),
    queryFn: () => api.places.search(q),
    enabled: q.length >= 2,
    staleTime: 2 * 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
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
  return useQuery({ queryKey: qk.pins, queryFn: api.pins.get, enabled: status === "signedIn", staleTime: 60_000 });
}

export function useNeighborhoodIndex() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.neighborhoods, queryFn: api.neighborhoods, enabled: status === "signedIn", staleTime: 60_000 });
}

export function useCollections() {
  const { status } = useAuth();
  return useQuery({ queryKey: qk.collections, queryFn: api.collections.list, enabled: status === "signedIn", staleTime: 30_000 });
}

export function useCollection(id: string, enabled = true) {
  return useQuery({ queryKey: qk.collection(id), queryFn: () => api.collections.get(id), enabled: enabled && id !== "", staleTime: 30_000 });
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
