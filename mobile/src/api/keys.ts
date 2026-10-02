/** React Query keys. Kept apart from the hooks so auth code can use them without an import cycle. */
export const qk = {
  me: ["me"] as const,
  places: ["places"] as const,
  nearby: (lat: number, lng: number) => ["places", "nearby", lat, lng] as const,
  feed: ["feed"] as const,
  following: ["me", "following"] as const,
  blocks: ["me", "blocks"] as const,
  profileSettings: ["me", "profile"] as const,
  followRequests: ["me", "follow-requests"] as const,
  activity: ["me", "activity"] as const,
  /** `user(handle)` is a prefix of the grid and places keys, so invalidating a passport refreshes its tabs too. */
  user: (handle: string) => ["user", handle] as const,
  userStamps: (handle: string) => ["user", handle, "stamps"] as const,
  userPlaces: (handle: string) => ["user", handle, "places"] as const,
  /** Under ["users", "connections"] so follow toggles patch these rows (see features/people/use-follow.ts). */
  people: (handle: string, list: "followers" | "following") => ["users", "connections", handle, list] as const,
  stamp: (id: string) => ["stamp", id] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  songSearch: (q: string) => ["songs", "search", q] as const,
  modQueue: ["mod", "queue"] as const,
  modHidden: ["mod", "hidden"] as const,
  modLog: ["mod", "log"] as const,
};
