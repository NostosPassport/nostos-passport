/**
 * Resolves the API base URL.
 * - `EXPO_PUBLIC_API_URL` wins (set per EAS profile: preview deploy for TestFlight, production for release).
 * - In development without it, use the Mac running Metro: Expo Go already reaches it over the LAN,
 *   and the backend's `pnpm dev` listens on port 3000 on the same machine.
 */
export const DEV_API_PORT = 3000;

export function resolveBaseUrl(envUrl: string | undefined, hostUri: string | undefined, isDev: boolean): string {
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (isDev && hostUri) {
    const host = hostUri.split("/")[0].replace(/:\d+$/, "");
    if (host) return `http://${host}:${DEV_API_PORT}`;
  }
  if (isDev) return `http://localhost:${DEV_API_PORT}`;
  throw new Error("EXPO_PUBLIC_API_URL is not set for this build. Set it in eas.json.");
}

/** Relative media paths (the backend's local storage driver) resolve against the API host; absolute URLs pass through. */
export function resolveMediaUrl(base: string, url: string): string {
  // "/path" is relative to the API host; "//host/path" (protocol-relative) is not.
  return /^\/(?!\/)/.test(url) ? `${base.replace(/\/+$/, "")}${url}` : url;
}
