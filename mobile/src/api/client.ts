/** Typed HTTP client for the Nostos API. */
import type { z } from "zod";
import * as C from "./contracts";
import * as CC from "./collection-contracts";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_token"
  | "invalid_credentials"
  | "invalid_input"
  | "bad_request"
  | "objectionable_content"
  | "song_search_unavailable"
  | "places_unavailable"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "too_large"
  | "unsupported_type"
  | "length_required"
  | "offline"
  | "timeout"
  | "cancelled"
  | "bad_response"
  | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "Nostos isn't responding. Check your connection and try again.";
export const BAD_RESPONSE_MESSAGE = "Something went wrong on our end. Try again in a moment.";
export const REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

export type ApiConfig = {
  baseUrl: string;
  getToken: () => string | null;
  onInvalidToken: (sentToken: string) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const LenientError = C.ErrorResponse.passthrough();

export function errorText(e: unknown, fallback: string): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === "invalid_input" || e.code === "bad_request" || e.status >= 500) return fallback;
  return e.message;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function onlyUnknownKeys(issues: z.ZodIssue[]): boolean {
  return issues.length > 0 && issues.every((issue) => {
    if (issue.code === "unrecognized_keys") return true;
    if (issue.code === "invalid_union") return issue.unionErrors.some((e) => onlyUnknownKeys(e.issues));
    return false;
  });
}

export function parseResponse<S extends z.ZodTypeAny>(schema: S, json: unknown, path: string): z.infer<S> {
  const result = schema.safeParse(json);
  if (result.success) return result.data;
  if (onlyUnknownKeys(result.error.issues)) {
    if (__DEV__) console.info(`[api] ${path}: response has fields this app version doesn't know yet`);
    return json as z.infer<S>;
  }
  if (__DEV__) console.error(`[api] ${path}: response did not match the contract`, result.error.issues);
  throw new ApiError(0, "bad_response", BAD_RESPONSE_MESSAGE);
}

async function errorFrom(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try { body = await res.json(); } catch {}
  if (res.status >= 500) return new ApiError(res.status, "bad_response", BAD_RESPONSE_MESSAGE);
  const parsed = LenientError.safeParse(body);
  if (parsed.success) return new ApiError(res.status, parsed.data.error, parsed.data.message);
  if (res.status === 401 && /error="invalid_token"/.test(res.headers.get("WWW-Authenticate") ?? "")) {
    return new ApiError(401, "invalid_token", "Your session has ended. Sign in again.");
  }
  return new ApiError(res.status, "bad_request", BAD_RESPONSE_MESSAGE);
}

export function createApi(config: ApiConfig) {
  const doFetch = config.fetch ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;

  function headers(token: string | null, extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json", "X-Client": "ios", ...extra };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  async function handle<S extends z.ZodTypeAny>(res: Response, schema: S, path: string, sentToken: string | null): Promise<z.infer<S>> {
    if (!res.ok) {
      const err = await errorFrom(res);
      if (err.status === 401 && err.code === "invalid_token" && sentToken) config.onInvalidToken(sentToken);
      throw err;
    }
    let json: unknown;
    try { json = await res.json(); } catch { throw new ApiError(res.status, "bad_response", BAD_RESPONSE_MESSAGE); }
    return parseResponse(schema, json, path);
  }

  async function request<S extends z.ZodTypeAny>(method: Method, path: string, schema: S, body?: unknown, opts?: { token?: string | null }): Promise<z.infer<S>> {
    const token = opts && "token" in opts ? (opts.token ?? null) : config.getToken();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: headers(token, body === undefined ? undefined : { "Content-Type": "application/json" }),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw timedOut ? new ApiError(0, "timeout", TIMEOUT_MESSAGE) : new ApiError(0, "offline", OFFLINE_MESSAGE);
    } finally {
      clearTimeout(timer);
    }
    return handle(res, schema, path, token);
  }

  const enc = encodeURIComponent;

  return {
    baseUrl: base,
    webUrl: (path: string) => `${base}${path}`,

    auth: {
      signup: (body: C.SignupRequest) => request("POST", "/api/auth/signup", C.TokenResponse, body),
      login: (body: C.LoginRequest) => request("POST", "/api/auth/login", C.TokenResponse, body),
      logout: (token: string) => request("POST", "/api/auth/logout", C.OkResponse, undefined, { token }),
    },

    me: {
      get: (token?: string) => request("GET", "/api/me", C.MeResponse, undefined, token ? { token } : undefined),
      acceptTerms: (version: string) => request("POST", "/api/me/terms", C.AcceptTermsResponse, { version }),
      deleteAccount: (body: C.DeleteAccountRequest) => request("POST", "/api/me/delete", C.DeleteAccountResponse, body),
      profile: () => request("GET", "/api/me/profile", C.ProfileSettingsResponse),
      updateProfile: (body: C.ProfileSettingsRequest) => request("PATCH", "/api/me/profile", C.ProfileSettingsResponse, body),
      removeAvatar: () => request("DELETE", "/api/me/avatar", C.AvatarResponse),
    },

    places: {
      list: () => request("GET", "/api/places", C.PlacesResponse),
      get: (idOrSlug: string) => request("GET", `/api/places/${enc(idOrSlug)}`, C.PlaceResponse),
      mine: (idOrSlug: string, pos?: { lat: number; lng: number }) => request("GET", `/api/places/${enc(idOrSlug)}/mine${pos ? `?lat=${pos.lat}&lng=${pos.lng}` : ""}`, C.MyPlacePageResponse),
      nearby: (pos: { lat: number; lng: number }, radiusM = 750) => request("GET", `/api/places/nearby?lat=${pos.lat}&lng=${pos.lng}&radius=${Math.round(radiusM)}`, C.NearbyPlacesResponse),
      search: (q: string, pos?: { lat: number; lng: number }) => request("GET", `/api/places/search?q=${enc(q)}${pos ? `&lat=${pos.lat}&lng=${pos.lng}` : ""}`, C.PlacesResponse),
    },

    collections: {
      list: () => request("GET", "/api/collections", CC.CollectionsResponse),
      get: (id: string) => request("GET", `/api/collections/${enc(id)}`, CC.CollectionResponse),
      create: (body: CC.CollectionCreateRequest) => request("POST", "/api/collections", CC.CollectionResponse, body),
      update: (id: string, body: CC.CollectionUpdateRequest) => request("PATCH", `/api/collections/${enc(id)}`, CC.CollectionResponse, body),
      remove: (id: string) => request("DELETE", `/api/collections/${enc(id)}`, CC.DeleteCollectionResponse),
      setForStamp: (stampId: string, collectionIds: string[]) => request("PUT", `/api/stamps/${enc(stampId)}/collections`, CC.StampCollectionsResponse, { collectionIds }),
    },

    stamps: {
      layout: (id: string, body: C.PhotoLayoutRequest) => request("PATCH", `/api/stamps/${enc(id)}/photos`, C.StampResponse, body),
      removePhoto: (id: string, photoId: string) => request("POST", `/api/stamps/${enc(id)}/photos/${enc(photoId)}/remove`, C.StampResponse),
      get: (id: string) => request("GET", `/api/stamps/${enc(id)}`, C.StampResponse),
      edit: (id: string, body: C.StampEditRequest) => request("PATCH", `/api/stamps/${enc(id)}`, C.StampResponse, body),
      remove: (id: string) => request("POST", `/api/stamps/${enc(id)}/remove`, C.RemoveStampResponse),
    },

    pins: {
      get: () => request("GET", "/api/me/pins", C.PinsResponse),
      set: (stampIds: string[]) => request("PUT", "/api/me/pins", C.PinsResponse, { stampIds }),
    },
    neighborhoods: () => request("GET", "/api/me/neighborhoods", C.NeighborhoodIndexResponse),
    songs: { search: (q: string) => request("GET", `/api/songs/search?q=${enc(q)}`, C.SongSearchResponse) },
    users: {
      stamps: (handle: string, after?: string | null) => request("GET", `/api/users/${enc(handle)}/stamps${after ? `?after=${enc(after)}` : ""}`, C.UserStampsResponse),
      places: (handle: string) => request("GET", `/api/users/${enc(handle)}/places`, C.UserPlacesResponse),
    },

    upload<S extends z.ZodTypeAny>(path: string, schema: S, form: FormData, opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<z.infer<S>> {
      const token = config.getToken();
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${base}${path}`);
        xhr.timeout = UPLOAD_TIMEOUT_MS;
        for (const [k, v] of Object.entries(headers(token))) xhr.setRequestHeader(k, v);
        if (opts.onProgress) {
          const onProgress = opts.onProgress;
          xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total)); };
        }
        const onAbort = () => xhr.abort();
        opts.signal?.addEventListener("abort", onAbort);
        const done = () => opts.signal?.removeEventListener("abort", onAbort);
        xhr.onerror = () => { done(); reject(new ApiError(0, "offline", OFFLINE_MESSAGE)); };
        xhr.ontimeout = () => { done(); reject(new ApiError(0, "timeout", TIMEOUT_MESSAGE)); };
        xhr.onabort = () => { done(); reject(new ApiError(0, "cancelled", "Upload cancelled.")); };
        xhr.onload = () => {
          done();
          if (xhr.status === 0) return reject(new ApiError(0, "offline", OFFLINE_MESSAGE));
          const res = new Response(xhr.responseText, { status: xhr.status, headers: { "Content-Type": "application/json", "WWW-Authenticate": xhr.getResponseHeader("WWW-Authenticate") ?? "" } });
          handle(res, schema, path, token).then(resolve, reject);
        };
        if (opts.signal?.aborted) { done(); return reject(new ApiError(0, "cancelled", "Upload cancelled.")); }
        xhr.send(form);
      });
    },
  };
}

export type Api = ReturnType<typeof createApi>;
