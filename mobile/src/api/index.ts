import Constants from "expo-constants";

import { resolveBaseUrl, resolveMediaUrl } from "./base-url";
import { createApi } from "./client";
import { tokenStore } from "@/auth/token-store";

export { ApiError, errorText } from "./client";
export type { Api } from "./client";

export const api = createApi({
  baseUrl: resolveBaseUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri, __DEV__),
  getToken: () => tokenStore.current(),
  onInvalidToken: (sent) => tokenStore.invalidate(sent),
});

/**
 * Photo URLs are absolute signed R2 URLs in preview/production, but the backend's local storage
 * driver (development) returns paths like `/api/uploads/...`. Resolve those against the API host.
 */
export function mediaUrl(url: string): string {
  return resolveMediaUrl(api.baseUrl, url);
}
