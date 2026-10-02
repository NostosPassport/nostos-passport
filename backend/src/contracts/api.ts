/**
 * Nostos HTTP API contract: the single source of truth for clients (the Expo iOS app copies this file
 * verbatim into src/api/contracts.ts). Depends only on `zod` **v3** (written against 3.25; install `zod@^3.25`,
 * not v4). Every response schema is `.strict()`, and
 * tests/integration/contracts.test.ts calls every route and fails if a response drifts from these schemas.
 * Human-readable reference: API.md.
 *
 * Conventions: JSON bodies; timestamps are ISO-8601 UTC strings. Errors are `{ error: <code>, message: <human sentence> }`.
 * A stamp is one visit to a place: a photo, a caption, a song, or any mix. Nothing here is ever "Anonymous":
 * a stamp is only returned to people who may see its author's full profile.
 */
import { z } from "zod";

// ------------------------------------------------------------------------------------------------
// Primitives and enums
// ------------------------------------------------------------------------------------------------

export const IsoDate = z.string().datetime({ offset: true });
export const Role = z.enum(["USER", "MODERATOR", "ADMIN"]);
/** What can be reported or moderated. The database calls a stamp "PHOTO"; the API says STAMP. */
export const TargetType = z.enum(["STAMP", "USER"]);
export const ModerationAction = z.enum(["FLAGGED", "AUTO_HIDE", "HIDE", "DISMISS", "RESTORE", "ACCOUNT_DELETED", "SUSPEND", "UNSUSPEND"]);

export const ErrorResponse = z
  .object({
    /** Machine-readable code, e.g. "unauthorized", "invalid_token", "forbidden", "rate_limited", "objectionable_content", "private_account". */
    error: z.string(),
    /** Human sentence, safe to show inline (e.g. "You need to be within 100 m of this place to stamp it (you're 140 m away)"). */
    message: z.string(),
  })
  .strict();

/** ODbL attribution; show wherever OpenStreetMap-sourced place data appears. */
export const Attribution = z.object({ text: z.literal("© OpenStreetMap contributors"), url: z.string().url(), license: z.literal("ODbL-1.0") }).strict();

export const PublicUser = z.object({ id: z.string(), handle: z.string(), displayName: z.string(), role: Role }).strict();

/** "requested" = a pending request to a private account. */
export const FollowState = z.enum(["none", "requested", "following"]);
/**
 * A person in a list (search, followers, following, requests). The handle and verified badge always; displayName
 * and avatarUrl are null when the account is private and the viewer doesn't follow it (show a generic avatar).
 */
export const PersonView = z.object({ handle: z.string(), displayName: z.string().nullable(), avatarUrl: z.string().nullable(), verified: z.boolean() }).strict();
/** A person plus the viewer's follow state toward them (drives Follow / Requested / Following buttons). */
export const PersonRow = PersonView.extend({ follow: FollowState, isSelf: z.boolean() }).strict();
export const PlaceRef = z.object({ id: z.string(), slug: z.string(), name: z.string(), neighborhood: z.string() }).strict();

// ------------------------------------------------------------------------------------------------
// Auth and account
// ------------------------------------------------------------------------------------------------

export const SignupRequest = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(10).max(200),
    displayName: z.string().trim().min(1).max(60),
    handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
    acceptTerms: z.literal(true),
    confirm21: z.literal(true),
  })
  .strict();
export const LoginRequest = z.object({ email: z.string().trim().email().max(200), password: z.string().max(200) }).strict();
/** POST /api/auth/login and /api/auth/signup with header `X-Client: ios`. */
export const TokenResponse = z.object({ token: z.string(), expiresAt: IsoDate, user: PublicUser }).strict();
/** Same endpoints without X-Client (web): the session is set as an httpOnly cookie. */
export const WebAuthResponse = z.object({ user: PublicUser }).strict();
export const OkResponse = z.object({ ok: z.literal(true) }).strict();
export const LogoutAllResponse = z.object({ ok: z.literal(true), revoked: z.number().int() }).strict();

export const MeResponse = z
  .object({
    user: z
      .object({
        id: z.string(), email: z.string(), handle: z.string(), displayName: z.string(), role: Role, memberSince: IsoDate, reputation: z.number(),
        isPrivate: z.boolean(), bio: z.string(), avatarUrl: z.string().nullable(), verified: z.boolean(),
      })
      .strict(),
    /** Badge count for the Follow requests entry. */
    social: z.object({ pendingFollowRequests: z.number().int() }).strict(),
    /** geofenceExempt: App Review / QA account that can stamp anywhere; its stamps are visible only to itself. */
    settings: z.object({ geofenceExempt: z.boolean() }).strict(),
    terms: z
      .object({ acceptedVersion: z.string().nullable(), acceptedAt: IsoDate.nullable(), currentVersion: z.string(), needsAcceptance: z.boolean() })
      .strict(),
  })
  .strict();
export const AcceptTermsRequest = z.object({ version: z.string() }).strict();
export const AcceptTermsResponse = z.object({ acceptedVersion: z.string(), acceptedAt: IsoDate }).strict();
export const DeleteAccountRequest = z.object({ password: z.string().min(1).max(200) }).strict();
export const DeleteAccountResponse = z.object({ deleted: z.literal(true) }).strict();

// ------------------------------------------------------------------------------------------------
// Places
// ------------------------------------------------------------------------------------------------

/** A place: name, location and geofence. No live data. */
export const Place = z
  .object({
    id: z.string(), slug: z.string(), name: z.string(),
    /** May be "" for imported places without a mapped street address; show the neighborhood instead. */
    address: z.string(),
    neighborhood: z.string(), lat: z.number(), lng: z.number(),
    /** Radius in meters within which a phone may stamp this place (the server checks it again on every stamp). */
    geofenceMeters: z.number().int(),
    fromOsm: z.boolean(),
  })
  .strict();
export const PlacesResponse = z.object({ places: z.array(Place), attribution: Attribution.nullable() }).strict();
export const PlaceResponse = z.object({ place: Place }).strict();
/** GET /api/places/nearby?lat=&lng=: nearest first. `inside` = within its geofence right now. The position is never stored. */
export const NearbyPlacesResponse = z.object({ places: z.array(Place.extend({ distanceM: z.number().int(), inside: z.boolean() }).strict()) }).strict();

// ------------------------------------------------------------------------------------------------
// Stamps
// ------------------------------------------------------------------------------------------------

/** Like count (App Review likes excluded) and whether you liked it. */
export const LikeSummary = z.object({ count: z.number().int(), viewerLiked: z.boolean() }).strict();
/** Album art only from Apple's artwork CDN, over https (the server enforces the same rule). */
export const AppleArtUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && /(^|\.)mzstatic\.com$/.test(url.hostname);
    } catch {
      return false;
    }
  }, "Song art must be an https link from Apple's artwork servers");
/** Song metadata only (no audio). */
export const Song = z.object({ title: z.string(), artist: z.string(), artUrl: z.string().nullable(), sourceId: z.string().nullable() }).strict();
/**
 * A stamp. Photo URLs are short-lived signed URLs (15-20 min): refetch rather than caching URLs. There are no
 * coordinates, storage keys or user ids anywhere in it. `hidden` / `removed` are true only for staff viewers.
 */
export const StampView = z
  .object({
    id: z.string(),
    photoUrl: z.string().nullable(),
    caption: z.string(),
    song: Song.nullable(),
    createdAt: IsoDate,
    editedAt: IsoDate.nullable(),
    place: PlaceRef,
    author: z.object({ handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), verified: z.boolean() }).strict(),
    mine: z.boolean(),
    likes: LikeSummary,
    hidden: z.boolean(),
    removed: z.boolean(),
  })
  .strict();
export const StampResponse = z.object({ stamp: StampView }).strict();
/**
 * POST /api/places/:id/stamps (multipart/form-data): optional `photo` file, `caption`, `songTitle`, `songArtist`,
 * `songArtUrl`, `songSourceId`, `lat`, `lng` (and an optional `rating` 1-10 that v1 doesn't show). At least one of
 * photo, caption or song. 403 outside the geofence, with a message that says how far away you are.
 */
export const CreateStampResponse = StampResponse;
/** PATCH /api/stamps/:id: caption and song; send only changed fields. `song: null` removes the song. */
export const StampEditRequest = z
  .object({
    caption: z.string().trim().max(280),
    song: z.object({ title: z.string().trim().min(1).max(200), artist: z.string().trim().min(1).max(200), artUrl: AppleArtUrl.nullish(), sourceId: z.string().trim().min(1).max(100).nullish() }).strict().nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export const RemoveStampResponse = z.object({ removed: z.literal(true) }).strict();
/** PUT/DELETE /api/stamps/:id/like. */
export const LikeResponse = z.object({ liked: z.boolean(), count: z.number().int(), viewerLiked: z.boolean() }).strict();
/** Feed and passport grid, newest first. `nextBefore` = an opaque cursor: pass it as ?before= for the next page; null = the end. */
export const StampsPageResponse = z.object({ stamps: z.array(StampView), nextBefore: z.string().nullable() }).strict();
export const FeedResponse = StampsPageResponse;
export const UserStampsResponse = StampsPageResponse;
export const UserPlacesResponse = z
  .object({
    places: z.array(
      z
        .object({
          place: z.object({ id: z.string(), slug: z.string(), name: z.string(), neighborhood: z.string(), lat: z.number(), lng: z.number() }).strict(),
          stamps: z.number().int(),
          latestStamp: z.object({ id: z.string(), createdAt: IsoDate, photoUrl: z.string().nullable(), caption: z.string() }).strict(),
        })
        .strict(),
    ),
  })
  .strict();

/** GET /api/songs/search?q= : metadata from Apple's iTunes Search API, proxied. */
export const SongResult = z.object({ title: z.string(), artist: z.string(), album: z.string().nullable(), artUrl: z.string().nullable(), sourceId: z.string() }).strict();
export const SongSearchResponse = z.object({ songs: z.array(SongResult) }).strict();

// ------------------------------------------------------------------------------------------------
// People
// ------------------------------------------------------------------------------------------------

export const UserSearchResponse = z.object({ users: z.array(PersonRow) }).strict();
export const Relationship = z
  .object({
    isSelf: z.boolean(),
    /** The viewer's follow state toward this account. */
    follow: FollowState,
    followsYou: z.boolean(),
    mutual: z.boolean(),
  })
  .strict();
/**
 * `access: "limited"`: a private account the viewer doesn't follow. Show the handle, the badge, a generic avatar,
 * "This account is private" and Follow (Request) / Requested. Everything else, including every stamp and place, is
 * only in `access: "full"`.
 */
export const ProfileResponse = z.discriminatedUnion("access", [
  z
    .object({
      access: z.literal("full"),
      user: z
        .object({
          handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), bio: z.string(), verified: z.boolean(), isPrivate: z.boolean(),
          memberSince: IsoDate,
          /** Private: present for yourself and for moderators, otherwise null. */
          reputation: z.number().nullable(),
          counts: z.object({ stamps: z.number().int(), places: z.number().int(), followers: z.number().int(), following: z.number().int() }).strict(),
        })
        .strict(),
      relationship: Relationship,
    })
    .strict(),
  z
    .object({
      access: z.literal("limited"),
      user: z.object({ handle: z.string(), verified: z.boolean(), isPrivate: z.literal(true) }).strict(),
      relationship: Relationship,
    })
    .strict(),
]);
export const FollowingResponse = z
  .object({ following: z.array(z.object({ handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), verified: z.boolean(), mutual: z.boolean() }).strict()) })
  .strict();
/** PUT follow: public account -> "following"; private account -> "requested". DELETE (unfollow or cancel) -> "none". */
export const FollowResponse = z.object({ state: FollowState }).strict();
const StampRef = z.object({ id: z.string(), url: z.string().nullable(), place: z.object({ name: z.string(), slug: z.string() }).strict() }).strict();
/** GET /api/me/activity: newest first, last 30 days (pending requests of any age). In-app only. */
export const ActivityResponse = z
  .object({
    items: z.array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("follow_request"), at: IsoDate, person: PersonView }).strict(),
        z.object({ kind: z.literal("new_follower"), at: IsoDate, person: PersonView }).strict(),
        z.object({ kind: z.literal("like"), at: IsoDate, person: PersonView, stamp: StampRef }).strict(),
      ]),
    ),
  })
  .strict();
/** GET /api/users/:handle/followers and /following (403 `private_account` without full access). */
export const PeopleListResponse = z.object({ people: z.array(PersonRow) }).strict();
export const FollowRequestsResponse = z.object({ requests: z.array(z.object({ person: PersonView, requestedAt: IsoDate }).strict()) }).strict();
export const FollowRequestDecisionRequest = z.object({ approve: z.boolean() }).strict();
export const FollowRequestDecisionResponse = z.object({ approved: z.boolean() }).strict();
export const ApproveAllResponse = z.object({ approved: z.number().int() }).strict();
export const RemoveFollowerResponse = z.object({ removed: z.literal(true) }).strict();
/** PATCH /api/me/profile: send only changed fields. */
export const ProfileSettingsRequest = z
  .object({ displayName: z.string().trim().min(1).max(60), bio: z.string().trim().max(150), isPrivate: z.boolean() })
  .partial()
  .strict();
export const ProfileSettingsResponse = z
  .object({
    profile: z.object({ handle: z.string(), displayName: z.string(), bio: z.string(), isPrivate: z.boolean(), avatarUrl: z.string().nullable(), verified: z.boolean() }).strict(),
    /** After switching to public, offer "Approve N pending requests?" when this is above 0. */
    pendingRequests: z.number().int(),
  })
  .strict();
/** POST /api/me/avatar (multipart `photo`) and DELETE /api/me/avatar. */
export const AvatarResponse = z.object({ avatarUrl: z.string().nullable() }).strict();
export const BlockResponse = z.object({ blocked: z.boolean() }).strict();
/** Your blocks, newest first. Unblock with DELETE /api/users/:handle/block. */
export const BlocksResponse = z.object({ blocks: z.array(z.object({ handle: z.string(), blockedAt: IsoDate }).strict()) }).strict();

// ------------------------------------------------------------------------------------------------
// Flags and moderation
// ------------------------------------------------------------------------------------------------

/** targetId: the stamp id; for USER, the account id or handle. */
export const FlagRequest = z.object({ targetType: TargetType, targetId: z.string().min(1).max(64), reason: z.string().trim().min(3).max(300) }).strict();
export const FlagResponse = z.object({ flag: z.object({ id: z.string() }).strict(), autoHidden: z.boolean() }).strict();
export const ModActionRequest = z
  .object({ targetType: TargetType, targetId: z.string().min(1).max(64), action: z.enum(["HIDE", "DISMISS", "RESTORE", "SUSPEND", "UNSUSPEND"]), note: z.string().trim().max(300).optional() })
  .strict();
export const ModActionResponse = z.object({ target: z.object({ id: z.string(), hidden: z.boolean() }).strict().nullable() }).strict();
export const ModQueueItem = z
  .object({
    targetType: TargetType,
    targetId: z.string(),
    /** The place of a stamp; null for USER (account) reports. */
    venue: z.object({ name: z.string(), slug: z.string() }).strict().nullable(),
    content: z
      .object({
        kind: TargetType,
        preview: z.string(),
        /** Signed URL for photos (moderators can see hidden ones). */
        url: z.string().optional(),
        author: z.string(),
        authorRep: z.number(),
        /** Hidden (stamp) or suspended (account) time. */
        hiddenAt: IsoDate.nullable(),
        createdAt: IsoDate,
      })
      .strict()
      .nullable(),
    flags: z.array(z.object({ id: z.string(), reason: z.string(), createdAt: IsoDate, by: z.string(), byRole: Role }).strict()),
    history: z.array(z.object({ action: ModerationAction, by: z.string(), note: z.string().nullable(), at: IsoDate }).strict()),
  })
  .strict();
export const ModQueueResponse = z.object({ items: z.array(ModQueueItem) }).strict();
/** Hidden stamps and suspended accounts (newest first) for the Restore / Unsuspend screen. */
export const ModHiddenResponse = z
  .object({
    items: z.array(
      z
        .object({
          targetType: TargetType, targetId: z.string(), venue: z.object({ name: z.string(), slug: z.string() }).strict().nullable(),
          preview: z.string(), url: z.string().optional(), author: z.string(), hiddenAt: IsoDate,
        })
        .strict(),
    ),
  })
  .strict();
export const ModLogResponse = z
  .object({
    events: z.array(
      z.object({ id: z.string(), action: ModerationAction, targetType: z.enum(["PHOTO", "COMMENT", "REPORT", "USER"]), targetId: z.string(), by: z.string(), note: z.string().nullable(), createdAt: IsoDate }).strict(),
    ),
  })
  .strict();

// ------------------------------------------------------------------------------------------------
// Admin (web only; not used by the iOS app)
// ------------------------------------------------------------------------------------------------

export const AdminUserFlagsResponse = z.object({ user: z.object({ handle: z.string(), geofenceExempt: z.boolean() }).strict() }).strict();
export const AdminUserSearchResponse = z
  .object({
    users: z.array(
      z
        .object({
          handle: z.string(), displayName: z.string(), email: z.string(), role: Role, isPrivate: z.boolean(),
          verified: z.boolean(), verifiedAt: IsoDate.nullable(), suspended: z.boolean(), memberSince: IsoDate,
        })
        .strict(),
    ),
  })
  .strict();
/** POST /api/admin/users/:handle/verification. The note is required and goes into the append-only log. */
export const VerificationRequest = z.object({ verified: z.boolean(), note: z.string().trim().min(3).max(300) }).strict();
export const VerificationResponse = z.object({ user: z.object({ handle: z.string(), verified: z.boolean(), verifiedAt: IsoDate.nullable() }).strict() }).strict();
export const VerificationLogResponse = z
  .object({ events: z.array(z.object({ id: z.string(), handle: z.string(), action: z.enum(["GRANT", "REVOKE"]), note: z.string(), by: z.string(), at: IsoDate }).strict()) })
  .strict();

// ------------------------------------------------------------------------------------------------
// Ops
// ------------------------------------------------------------------------------------------------

export const CronResponse = z.object({ ok: z.literal(true), prunedLoginAttempts: z.number().int(), prunedRateEvents: z.number().int(), ms: z.number() }).strict();

export const HealthResponse = z
  .object({ ok: z.literal(true), db: z.literal("up"), env: z.string(), commit: z.string().nullable(), ms: z.number() })
  .strict();

// ------------------------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------------------------

export type ErrorResponse = z.infer<typeof ErrorResponse>;
export type Attribution = z.infer<typeof Attribution>;
export type PublicUser = z.infer<typeof PublicUser>;
export type Role = z.infer<typeof Role>;
export type TargetType = z.infer<typeof TargetType>;
export type FollowState = z.infer<typeof FollowState>;
export type PersonView = z.infer<typeof PersonView>;
export type PersonRow = z.infer<typeof PersonRow>;
export type Relationship = z.infer<typeof Relationship>;
export type PlaceRef = z.infer<typeof PlaceRef>;
export type Place = z.infer<typeof Place>;
export type PlacesResponse = z.infer<typeof PlacesResponse>;
export type NearbyPlacesResponse = z.infer<typeof NearbyPlacesResponse>;
export type LikeSummary = z.infer<typeof LikeSummary>;
export type Song = z.infer<typeof Song>;
export type StampView = z.infer<typeof StampView>;
export type StampResponse = z.infer<typeof StampResponse>;
export type StampEditRequest = z.infer<typeof StampEditRequest>;
export type StampsPageResponse = z.infer<typeof StampsPageResponse>;
export type UserPlacesResponse = z.infer<typeof UserPlacesResponse>;
export type SongResult = z.infer<typeof SongResult>;
export type SongSearchResponse = z.infer<typeof SongSearchResponse>;
export type ActivityResponse = z.infer<typeof ActivityResponse>;
export type PeopleListResponse = z.infer<typeof PeopleListResponse>;
export type FollowRequestsResponse = z.infer<typeof FollowRequestsResponse>;
export type ProfileSettingsRequest = z.infer<typeof ProfileSettingsRequest>;
export type ProfileSettingsResponse = z.infer<typeof ProfileSettingsResponse>;
export type SignupRequest = z.infer<typeof SignupRequest>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type TokenResponse = z.infer<typeof TokenResponse>;
export type MeResponse = z.infer<typeof MeResponse>;
export type ProfileResponse = z.infer<typeof ProfileResponse>;
export type FollowingResponse = z.infer<typeof FollowingResponse>;
export type BlocksResponse = z.infer<typeof BlocksResponse>;
export type UserSearchResponse = z.infer<typeof UserSearchResponse>;
export type FlagRequest = z.infer<typeof FlagRequest>;
export type ModQueueItem = z.infer<typeof ModQueueItem>;
export type ModQueueResponse = z.infer<typeof ModQueueResponse>;
