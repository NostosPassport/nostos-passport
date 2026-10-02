/** React Query keys. Kept apart from the hooks so auth code can use them without an import cycle. */
export const qk = {
  me: ["me"] as const,
  venues: ["venues"] as const,
  venue: (id: string) => ["venue", id] as const,
  following: ["me", "following"] as const,
  blocks: ["me", "blocks"] as const,
  profileSettings: ["me", "profile"] as const,
  followRequests: ["me", "follow-requests"] as const,
  activity: ["me", "activity"] as const,
  /** `user(handle)` is a prefix of the grid and places keys, so invalidating a profile refreshes its tabs too. */
  user: (handle: string) => ["user", handle] as const,
  userPosts: (handle: string) => ["user", handle, "posts"] as const,
  userPlaces: (handle: string) => ["user", handle, "places"] as const,
  /** Under ["users", "connections"] so follow toggles patch these rows (see features/people/use-follow.ts). */
  people: (handle: string, list: "followers" | "following") => ["users", "connections", handle, list] as const,
  post: (id: string) => ["post", id] as const,
  /** Not under ["venue", ...]: `invalidateVenue` reads venue pages from those keys. */
  featuredMonth: (venueId: string, month: string) => ["featured", venueId, month] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  ownerDashboard: (id: string) => ["owner", id] as const,
  modQueue: ["mod", "queue"] as const,
  modHidden: ["mod", "hidden"] as const,
  modLog: ["mod", "log"] as const,
};
