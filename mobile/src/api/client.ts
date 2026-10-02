/**
 * Typed HTTP client for the Nostos API (see backend/API.md).
 *
 * Every response is parsed with the zod schemas in ./contracts. The server decides every rule
 * (geofence, cooldowns, permissions); on failure the client surfaces the server's
 * `message` unchanged through `ApiError` so screens can show it inline.
 */
import type { z } from "zod";

import * as C from "./contracts";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_token"
  | "invalid_credentials"
  | "invalid_input"
  | "bad_request"
  | "objectionable_content"
  | "private_account"
  | "song_search_unavailable"
  | "forbidden"
  | "wrong_password"
  | "account_suspended"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "too_large"
  | "unsupported_type"
  | "length_required"
  // Client-side codes
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

  /** 4xx errors are final: retrying the same request gives the same answer. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "Nostos isn't responding. Check your connection and try again.";
export const BAD_RESPONSE_MESSAGE = "Something went wrong on our end. Try again in a moment.";

/** JSON requests give up after this long (iOS would otherwise wait about 60 s). */
export const REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

export type ApiConfig = {
  baseUrl: string;
  getToken: () => string | null;
  /**
   * Called on a dead-token response (401 `invalid_token`) with the token that request sent, so a
   * late answer for a previous account never signs out the current one.
   */
  onInvalidToken: (sentToken: string) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Error bodies are parsed leniently: an extra field must never hide an `invalid_token`. */
const LenientError = C.ErrorResponse.passthrough();

/** Sentences for errors whose server text isn't written for this screen (validation, 5xx). */
export function errorText(e: unknown, fallback: string): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === "invalid_input" || e.code === "bad_request" || e.status >= 500) return fallback;
  return e.message;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * True when a parse failure is only about keys the app doesn't know yet. Responses are `.strict()`
 * so the backend's drift tests catch contract changes, but a shipped app must keep working when a
 * newer backend adds a field. Anything else (missing field, wrong type) is still a hard failure.
 */
export function onlyUnknownKeys(issues: z.ZodIssue[]): boolean {
  return (
    issues.length > 0 &&
    issues.every((issue) => {
      if (issue.code === "unrecognized_keys") return true;
      if (issue.code === "invalid_union") return issue.unionErrors.some((e) => onlyUnknownKeys(e.issues));
      return false;
    })
  );
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
  try {
    body = await res.json();
  } catch {
    // Non-JSON error (proxy page, gateway timeout): fall through to a generic message.
  }
  if (res.status >= 500) return new ApiError(res.status, "bad_response", BAD_RESPONSE_MESSAGE);
  const parsed = LenientError.safeParse(body);
  if (parsed.success) return new ApiError(res.status, parsed.data.error, parsed.data.message);
  // The backend also names a dead bearer token in WWW-Authenticate (RFC 6750).
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
    try {
      json = await res.json();
    } catch {
      throw new ApiError(res.status, "bad_response", BAD_RESPONSE_MESSAGE);
    }
    return parseResponse(schema, json, path);
  }

  async function request<S extends z.ZodTypeAny>(
    method: Method,
    path: string,
    schema: S,
    body?: unknown,
    opts?: { token?: string | null },
  ): Promise<z.infer<S>> {
    const token = opts && "token" in opts ? (opts.token ?? null) : config.getToken();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
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
    /** Absolute URL of a public web page on the same host (legal pages). */
    webUrl: (path: string) => `${base}${path}`,

    auth: {
      signup: (body: C.SignupRequest) => request("POST", "/api/auth/signup", C.TokenResponse, body),
      login: (body: C.LoginRequest) => request("POST", "/api/auth/login", C.TokenResponse, body),
      /** Revoke a specific token (the one just cleared locally). */
      logout: (token: string) => request("POST", "/api/auth/logout", C.OkResponse, undefined, { token }),
    },

    me: {
      /** Pass `token` to load an account before switching to it (sign-in). */
      get: (token?: string) => request("GET", "/api/me", C.MeResponse, undefined, token ? { token } : undefined),
      acceptTerms: (version: string) => request("POST", "/api/me/terms", C.AcceptTermsResponse, { version }),
      deleteAccount: (password: string) => request("POST", "/api/me/delete", C.DeleteAccountResponse, { password }),
      blocks: () => request("GET", "/api/me/blocks", C.BlocksResponse),
      following: () => request("GET", "/api/me/following", C.FollowingResponse),
      profile: () => request("GET", "/api/me/profile", C.ProfileSettingsResponse),
      /** Send only changed fields. */
      updateProfile: (body: C.ProfileSettingsRequest) => request("PATCH", "/api/me/profile", C.ProfileSettingsResponse, body),
      /** Upload a new photo with `upload("/api/me/avatar", AvatarResponse, form)`. */
      removeAvatar: () => request("DELETE", "/api/me/avatar", C.AvatarResponse),
      followRequests: () => request("GET", "/api/me/follow-requests", C.FollowRequestsResponse),
      decideRequest: (handle: string, approve: boolean) =>
        request("POST", `/api/me/follow-requests/${enc(handle)}`, C.FollowRequestDecisionResponse, { approve }),
      approveAllRequests: () => request("POST", "/api/me/follow-requests/approve-all", C.ApproveAllResponse),
      removeFollower: (handle: string) => request("DELETE", `/api/me/followers/${enc(handle)}`, C.RemoveFollowerResponse),
      activity: () => request("GET", "/api/me/activity", C.ActivityResponse),
    },

    places: {
      list: () => request("GET", "/api/places", C.PlacesResponse),
      get: (idOrSlug: string) => request("GET", `/api/places/${enc(idOrSlug)}`, C.PlaceResponse),
      /** Places inside or near the geofence of a position, nearest first. The server never stores the position. */
      nearby: (pos: { lat: number; lng: number }) => request("GET", `/api/places/nearby?lat=${pos.lat}&lng=${pos.lng}`, C.NearbyPlacesResponse),
      /** Upload a stamp with `upload("/api/places/:id/stamps", CreateStampResponse, form)`. */
    },

    stamps: {
      get: (id: string) => request("GET", `/api/stamps/${enc(id)}`, C.StampResponse),
      /** Caption and song only; send only changed fields (`song: null` removes the song). */
      edit: (id: string, body: C.StampEditRequest) => request("PATCH", `/api/stamps/${enc(id)}`, C.StampResponse, body),
      /** "Delete from profile": hides the stamp for good (nothing is ever deleted). */
      remove: (id: string) => request("POST", `/api/stamps/${enc(id)}/remove`, C.RemoveStampResponse),
      like: (id: string, like: boolean) => request(like ? "PUT" : "DELETE", `/api/stamps/${enc(id)}/like`, C.LikeResponse),
    },

    /** Home feed: people you follow, newest first. Pass the previous page's `nextBefore` for the next page. */
    feed: (before?: string | null) => request("GET", `/api/feed${before ? `?before=${enc(before)}` : ""}`, C.FeedResponse),

    songs: {
      search: (q: string) => request("GET", `/api/songs/search?q=${enc(q)}`, C.SongSearchResponse),
    },

    users: {
      search: (q: string) => request("GET", `/api/users?q=${enc(q)}`, C.UserSearchResponse),
      get: (handle: string) => request("GET", `/api/users/${enc(handle)}`, C.ProfileResponse),
      follow: (handle: string, follow: boolean) => request(follow ? "PUT" : "DELETE", `/api/users/${enc(handle)}/follow`, C.FollowResponse),
      block: (handle: string, block: boolean) => request(block ? "POST" : "DELETE", `/api/users/${enc(handle)}/block`, C.BlockResponse),
      /** Passport stamps grid, newest first; pass the previous page's `nextBefore` for the next page. */
      stamps: (handle: string, before?: string | null) =>
        request("GET", `/api/users/${enc(handle)}/stamps${before ? `?before=${enc(before)}` : ""}`, C.UserStampsResponse),
      places: (handle: string) => request("GET", `/api/users/${enc(handle)}/places`, C.UserPlacesResponse),
      /** 403 `private_account` without full access to the profile. */
      people: (handle: string, list: "followers" | "following") => request("GET", `/api/users/${enc(handle)}/${list}`, C.PeopleListResponse),
    },

    flags: {
      create: (body: C.FlagRequest) => request("POST", "/api/flags", C.FlagResponse, body),
    },

    mod: {
      queue: () => request("GET", "/api/mod/queue", C.ModQueueResponse),
      hidden: () => request("GET", "/api/mod/hidden", C.ModHiddenResponse),
      log: () => request("GET", "/api/mod/log", C.ModLogResponse),
      act: (body: z.infer<typeof C.ModActionRequest>) => request("POST", "/api/mod/actions", C.ModActionResponse, body),
    },

    /**
     * Multipart upload with progress (fetch has no upload progress on React Native).
     * Rejects with `offline`/`timeout`, or `cancelled` when `signal` aborts.
     */
    upload<S extends z.ZodTypeAny>(
      path: string,
      schema: S,
      form: FormData,
      opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
    ): Promise<z.infer<S>> {
      const token = config.getToken();
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${base}${path}`);
        xhr.timeout = UPLOAD_TIMEOUT_MS;
        for (const [k, v] of Object.entries(headers(token))) xhr.setRequestHeader(k, v);
        if (opts.onProgress) {
          const onProgress = opts.onProgress;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
          };
        }
        const onAbort = () => xhr.abort();
        opts.signal?.addEventListener("abort", onAbort);
        const done = () => opts.signal?.removeEventListener("abort", onAbort);
        xhr.onerror = () => {
          done();
          reject(new ApiError(0, "offline", OFFLINE_MESSAGE));
        };
        xhr.ontimeout = () => {
          done();
          reject(new ApiError(0, "timeout", TIMEOUT_MESSAGE));
        };
        xhr.onabort = () => {
          done();
          reject(new ApiError(0, "cancelled", "Upload cancelled."));
        };
        xhr.onload = () => {
          done();
          if (xhr.status === 0) return reject(new ApiError(0, "offline", OFFLINE_MESSAGE));
          const res = new Response(xhr.responseText, {
            status: xhr.status,
            headers: { "Content-Type": "application/json", "WWW-Authenticate": xhr.getResponseHeader("WWW-Authenticate") ?? "" },
          });
          handle(res, schema, path, token).then(resolve, reject);
        };
        if (opts.signal?.aborted) {
          done();
          return reject(new ApiError(0, "cancelled", "Upload cancelled."));
        }
        xhr.send(form);
      });
    },
  };
}

export type Api = ReturnType<typeof createApi>;
