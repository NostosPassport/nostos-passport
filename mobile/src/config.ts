/**
 * Build-time switches. SOCIAL_ENABLED (EXPO_PUBLIC_SOCIAL_ENABLED=1) turns the social layer back on: feed, follows, likes,
 * activity, blocks, other people's passports. Default off: Nostos v1 is strictly personal. The backend has the same flag
 * (SOCIAL_ENABLED) and 404s every social route when it is off.
 */
export const SOCIAL_ENABLED = process.env.EXPO_PUBLIC_SOCIAL_ENABLED === "1";
