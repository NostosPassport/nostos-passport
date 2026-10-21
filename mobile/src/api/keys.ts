/** React Query keys. */
export const qk = {
  me: ["me"] as const,
  places: ["places"] as const,
  nearby: (lat: number, lng: number, radiusM: number) => ["places", "nearby", lat, lng, radiusM] as const,
  placeSearch: (q: string, lat: number | null, lng: number | null) => ["places", "search", q, lat, lng] as const,
  profileSettings: ["me", "profile"] as const,
  placePage: (id: string, lat: number | null, lng: number | null) => ["places", "mine", id, lat, lng] as const,
  collections: ["collections"] as const,
  collection: (id: string) => ["collections", id] as const,
  collectionShare: (id: string) => ["collections", id, "share"] as const,
  userStamps: (handle: string) => ["user", handle, "stamps"] as const,
  userPlaces: (handle: string) => ["user", handle, "places"] as const,
  stamp: (id: string) => ["stamp", id] as const,
  songSearch: (q: string) => ["songs", "search", q] as const,
};
