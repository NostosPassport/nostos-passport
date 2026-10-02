/**
 * SOCIAL_ENABLED (default off). Nostos v1 is strictly personal: no feed, follows, likes, sharing, activity or blocks, and
 * every passport is visible only to its owner. With the flag on, the social layer works as built in session 1.
 * The flag is read on every call so tests can switch it.
 */
export function socialEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return ["1", "true", "yes"].includes((env.SOCIAL_ENABLED ?? "").trim().toLowerCase());
}
