/**
 * Nostos HTTP API contract: the single source of truth for clients (the Expo iOS app copies this file
 * verbatim into src/api/contracts.ts). Depends only on `zod` **v3** (written against 3.25; install `zod@^3.25`,
 * not v4). Every response schema is `.strict()`, and
 * tests/integration/contracts.test.ts calls every route and fails if a response drifts from these schemas.
 * Human-readable reference: API.md.
 *
 * Conventions: JSON bodies; timestamps are ISO-8601 UTC strings; money is integer cents; "tonight" is the
 * America/New_York night from 5:00am to 4:59am. Errors are `{ error: <code>, message: <human sentence> }`.
 */
import { z } from "zod";

// ------------------------------------------------------------------------------------------------
// Primitives and enums
// ------------------------------------------------------------------------------------------------

export const IsoDate = z.string().datetime({ offset: true });
export const Vibe = z.enum(["PACKED", "BUSY", "CHILL", "DEAD"]);
export const VibeState = z.enum(["PACKED", "BUSY", "CHILL", "DEAD", "NO_DATA"]);
export const LineWait = z.enum(["NONE", "UNDER_10", "TEN_TO_30", "OVER_30"]);
export const Role = z.enum(["USER", "VENUE_OWNER", "MODERATOR", "ADMIN"]);
export const ReportType = z.enum(["VIBE", "LINE", "COVER"]);
export const ContentType = z.enum(["PHOTO", "COMMENT", "REPORT", "USER"]);
export const ModerationAction = z.enum(["FLAGGED", "AUTO_HIDE", "HIDE", "DISMISS", "RESTORE", "ACCOUNT_DELETED", "SUSPEND", "UNSUSPEND"]);
export const ClaimStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const ErrorResponse = z
  .object({
    /** Machine-readable code, e.g. "unauthorized", "invalid_token", "forbidden", "rate_limited", "objectionable_content". */
    error: z.string(),
    /** Human sentence, safe to show inline (e.g. "You're 140 m away..."). */
    message: z.string(),
  })
  .strict();

/** ODbL attribution; show wherever OpenStreetMap-sourced venue data appears. */
export const Attribution = z.object({ text: z.literal("© OpenStreetMap contributors"), url: z.string().url(), license: z.literal("ODbL-1.0") }).strict();

export const PublicUser = z.object({ id: z.string(), handle: z.string(), displayName: z.string(), role: Role }).strict();

/**
 * The author of a photo, comment or reply, resolved for the viewer. Private accounts the viewer doesn't follow are
 * "anonymous" (no handle, no link); deleted accounts are "Deleted user". `regular` = a Regular at this venue.
 */
export const AuthorView = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), handle: z.string(), verified: z.boolean(), regular: z.boolean() }).strict(),
  z.object({ kind: z.literal("anonymous") }).strict(),
  z.object({ kind: z.literal("deleted") }).strict(),
]);
/** "requested" = a pending request to a private account. */
export const FollowState = z.enum(["none", "requested", "following"]);
/**
 * A person in a list (search, followers, following, requests). The handle and verified badge always; displayName
 * and avatarUrl are null when the account is private and the viewer doesn't follow it (show a generic avatar).
 */
export const PersonView = z.object({ handle: z.string(), displayName: z.string().nullable(), avatarUrl: z.string().nullable(), verified: z.boolean() }).strict();
/** A person plus the viewer's follow state toward them (drives Follow / Requested / Following buttons). */
export const PersonRow = PersonView.extend({ follow: FollowState, isSelf: z.boolean() }).strict();
export const VenueRef = z.object({ name: z.string(), slug: z.string() }).strict();
export const HoursEntry = z.object({ day: z.number().int().min(0).max(6), open: z.string(), close: z.string() }).strict();

// ------------------------------------------------------------------------------------------------
// Consensus and accuracy
// ------------------------------------------------------------------------------------------------

const consensusOf = <T extends z.ZodTypeAny>(value: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("ok"), value, reportCount: z.number().int(), userCount: z.number().int(), newestAt: IsoDate, totalWeight: z.number() }).strict(),
    z.object({ status: z.literal("insufficient"), reportCount: z.number().int(), userCount: z.number().int(), newestAt: IsoDate.nullable() }).strict(),
  ]);
export const VibeConsensus = consensusOf(Vibe);
export const LineConsensus = consensusOf(LineWait);
/** Cover value is integer cents (0 = free). */
export const CoverConsensus = consensusOf(z.number().int());

export const AccuracyWindow = z
  .object({ start: IsoDate, officialCents: z.array(z.number().int().nullable()), consensusCents: z.number().int(), users: z.number().int(), match: z.boolean() })
  .strict();
export const Accuracy = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), scorePct: z.number().int().min(0).max(100), qualifyingWindows: z.number().int(), matchingWindows: z.number().int(), windows: z.array(AccuracyWindow) }).strict(),
  z.object({ status: z.literal("insufficient"), qualifyingWindows: z.number().int(), matchingWindows: z.number().int(), windows: z.array(AccuracyWindow) }).strict(),
  /** Show "No official cover posted". */
  z.object({ status: z.literal("no_official_cover"), qualifyingWindows: z.literal(0), matchingWindows: z.literal(0), windows: z.array(AccuracyWindow).length(0) }).strict(),
]);

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
    ownedVenues: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() }).strict()),
    settings: z.object({ plansVisibleTo: z.literal("mutuals"), geofenceExempt: z.boolean() }).strict(),
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
// Map and venue
// ------------------------------------------------------------------------------------------------

export const MapVenue = z
  .object({
    id: z.string(), slug: z.string(), name: z.string(),
    /** May be "" for imported venues without a mapped street address; show the neighborhood instead. */
    address: z.string(),
    neighborhood: z.string(), lat: z.number(), lng: z.number(),
    vibe: VibeState, vibeReports: z.number().int(), hereNow: z.number().int(), goingTonight: z.number().int(),
    /** Mutual follows going tonight. */
    friendsGoing: z.number().int(),
    /** Live-activity sort key (here now x2 + distinct reporters in the last hour). */
    activity: z.number().int(),
    /** Has an active paid promo: show a neutral "Promoted" label. Never affects sort order. */
    promoted: z.boolean(),
    fromOsm: z.boolean(),
  })
  .strict();
export const VenuesResponse = z.object({ venues: z.array(MapVenue), attribution: Attribution.nullable(), at: IsoDate }).strict();

/** Photo URLs are short-lived signed URLs (valid 15-20 min): refetch the venue rather than caching URLs long-term. */
/** Like count (App Review likes excluded) and whether you liked it. */
export const LikeSummary = z.object({ count: z.number().int(), viewerLiked: z.boolean() }).strict();
/**
 * rating null = a live-only photo; 1-10 = a shared post (open it with GET /api/posts/:id). `likes` is null for
 * live-only photos, which can't be liked.
 */
export const PhotoView = z
  .object({
    id: z.string(), url: z.string(), caption: z.string(), createdAt: IsoDate, rating: z.number().int().min(1).max(10).nullable(), author: AuthorView, mine: z.boolean(),
    likes: LikeSummary.nullable(),
  })
  .strict();
/** A featured photo: its night (YYYY-MM-DD) and its place in that night's gallery (1-10). */
export const FeaturedPhotoView = PhotoView.extend({ likes: LikeSummary, night: z.string(), rank: z.number().int().min(1).max(10) }).strict();
export const FeaturedNight = z.object({ night: z.string(), photos: z.array(FeaturedPhotoView) }).strict();
export const ReplyView = z.object({ id: z.string(), body: z.string(), createdAt: IsoDate, author: AuthorView, mine: z.boolean() }).strict();
/** Replies are venue replies: label them with the venue name. */
export const CommentView = z
  .object({ id: z.string(), body: z.string(), createdAt: IsoDate, editedAt: IsoDate.nullable(), author: AuthorView, mine: z.boolean(), replies: z.array(ReplyView) })
  .strict();

export const VenuePageResponse = z
  .object({
    official: z
      .object({
        id: z.string(), slug: z.string(), name: z.string(), address: z.string(), neighborhood: z.string(), lat: z.number(), lng: z.number(),
        /** Empty = "Hours not posted". day 0 = Sunday; times are America/New_York "HH:MM"; close past midnight = next morning. */
        hours: z.array(HoursEntry),
        /** null = "No official cover posted"; 0 = free. */
        officialCoverCents: z.number().int().nullable(),
        dressCode: z.string().nullable(),
        /** Label it "From the venue". */
        officialPhotoUrl: z.string().nullable(),
        attribution: Attribution.nullable(),
        /** isPaid = show "Promoted". */
        promos: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), isPaid: z.boolean(), endsAt: IsoDate }).strict()),
        accuracy: Accuracy,
      })
      .strict(),
    live: z
      .object({
        hereNow: z.number().int(), goingTonight: z.number().int(),
        friendsGoing: z.array(z.object({ handle: z.string(), displayName: z.string() }).strict()),
        consensus: z.object({ vibe: VibeConsensus, line: LineConsensus, cover: CoverConsensus }).strict(),
        /** Show "Venue says $X · People say $Y". */
        coverMismatch: z.boolean(),
        /** Photos newer than 3 hours, newest first. */
        livePhotos: z.array(PhotoView),
        /** 3 to 24 hours old: collapsed, labelled "Not live". */
        earlierPhotos: z.array(PhotoView),
        comments: z.array(CommentView),
      })
      .strict(),
    /**
     * "This month's best" (current New York calendar month, newest night first; `total` may exceed the preview, the
     * rest is on GET /api/venues/:id/featured) and the archive of past months, newest first ("September's best").
     */
    featured: z
      .object({
        thisMonth: z.object({ month: z.string(), photos: z.array(FeaturedPhotoView), total: z.number().int() }).strict(),
        archive: z.array(z.object({ month: z.string(), count: z.number().int() }).strict()),
      })
      .strict(),
    viewer: z.object({ going: z.boolean(), hereNow: z.boolean(), ownsVenue: z.boolean() }).strict(),
    /** Server time the page was computed at. */
    now: IsoDate,
  })
  .strict();

// ------------------------------------------------------------------------------------------------
// Posting
// ------------------------------------------------------------------------------------------------

const Coords = { lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) };
export const ReportRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("VIBE"), vibe: Vibe, ...Coords }).strict(),
  z.object({ type: z.literal("LINE"), line: LineWait, ...Coords }).strict(),
  /** cover: "free" or dollars, e.g. "20" / "12.50" (max $500). */
  z.object({ type: z.literal("COVER"), cover: z.string().trim().max(10), ...Coords }).strict(),
]);
export const ReportResponse = z.object({ report: z.object({ id: z.string(), type: ReportType, createdAt: IsoDate }).strict() }).strict();
/**
 * POST multipart/form-data: photo (file), caption, lat, lng, and for a post: rating ("1".."10") and optionally shared
 * ("true"/"false"; default on for public accounts, off for private). Without a rating it's a live-only photo.
 */
export const PhotoResponse = z
  .object({ photo: z.object({ id: z.string(), createdAt: IsoDate, url: z.string(), caption: z.string(), rating: z.number().int().min(1).max(10).nullable(), shared: z.boolean() }).strict() })
  .strict();

// ------------------------------------------------------------------------------------------------
// Posts
// ------------------------------------------------------------------------------------------------

export const Rating = z.number().int().min(1).max(10);
export const PostView = z
  .object({
    id: z.string(), url: z.string(), rating: Rating, caption: z.string(), shared: z.boolean(), createdAt: IsoDate, editedAt: IsoDate.nullable(),
    author: AuthorView, venue: VenueRef, mine: z.boolean(),
    /** Your own post: the rating can change until then (end of its night). null for others. */
    ratingEditableUntil: IsoDate.nullable(),
    /** null for unshared posts (only shared posts can be liked). */
    likes: LikeSummary.nullable(),
  })
  .strict();
/** PUT/DELETE /api/posts/:id/like. */
export const LikeResponse = z.object({ liked: z.boolean(), count: z.number().int(), viewerLiked: z.boolean() }).strict();
/** GET /api/venues/:id/featured?month=YYYY-MM. */
export const FeaturedMonthResponse = z.object({ month: z.string(), nights: z.array(FeaturedNight) }).strict();
export const PostResponse = z.object({ post: PostView }).strict();
/** PATCH /api/posts/:id: send only changed fields. */
export const PostEditRequest = z.object({ rating: Rating, caption: z.string().trim().max(280), shared: z.boolean() }).partial().strict();
export const PostEditResponse = z
  .object({ post: z.object({ id: z.string(), rating: z.number().int().min(1).max(10).nullable(), caption: z.string(), shared: z.boolean(), editedAt: IsoDate.nullable() }).strict() })
  .strict();
export const RemovePostResponse = z.object({ removed: z.literal(true) }).strict();
export const PostTile = z.object({ id: z.string(), url: z.string(), rating: Rating, shared: z.boolean(), createdAt: IsoDate, venue: VenueRef }).strict();
/** Profile grid, newest first. `nextBefore` = an opaque cursor: pass it as ?before= for the next page; null = the end. */
export const UserPostsResponse = z.object({ posts: z.array(PostTile), nextBefore: z.string().nullable() }).strict();
export const UserPlacesResponse = z
  .object({
    places: z.array(
      z
        .object({
          venue: z.object({ name: z.string(), slug: z.string(), lat: z.number(), lng: z.number(), neighborhood: z.string() }).strict(),
          posts: z.number().int(),
          /** Their most recent rating there. */
          lastRating: Rating,
          lastPostedAt: IsoDate,
        })
        .strict(),
    ),
  })
  .strict();
export const CommentRequest = z.object({ body: z.string().trim().min(1).max(500) }).strict();
export const CommentCreatedResponse = z.object({ comment: z.object({ id: z.string() }).strict() }).strict();
export const CommentEditedResponse = z.object({ comment: z.object({ id: z.string(), body: z.string(), editedAt: IsoDate.nullable() }).strict() }).strict();
export const ReplyCreatedResponse = z.object({ reply: z.object({ id: z.string() }).strict() }).strict();
export const PresenceRequest = z.object(Coords).strict();
/** distanceM is the server-computed distance to the venue (use it for "You're 140 m away. Get closer to post."). */
export const PresenceResponse = z.union([
  z.object({ here: z.literal(true), expiresAt: IsoDate, distanceM: z.number().int(), radiusM: z.number().int() }).strict(),
  z.object({ here: z.literal(false), reason: z.enum(["outside", "venue_account"]), distanceM: z.number().int(), radiusM: z.number().int() }).strict(),
]);
export const RsvpResponse = z.object({ going: z.boolean(), night: z.string(), goingTonight: z.number().int() }).strict();

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
    /** Mutual approved follows ("friends": plans are shared). */
    mutual: z.boolean(),
  })
  .strict();
/**
 * `access: "limited"`: a private account the viewer doesn't follow. Show the handle, the badge, a generic avatar,
 * "This account is private" and Follow (Request) / Requested. Everything else is only in `access: "full"`.
 */
export const ProfileResponse = z.discriminatedUnion("access", [
  z
    .object({
      access: z.literal("full"),
      user: z
        .object({
          handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), bio: z.string(), verified: z.boolean(), isPrivate: z.boolean(),
          /** Venue accounts are labelled; staff roles are never revealed. */
          isVenueAccount: z.boolean(),
          memberSince: IsoDate,
          /** Private: present for yourself and for moderators, otherwise null. */
          reputation: z.number().nullable(),
          counts: z.object({ posts: z.number().int(), followers: z.number().int(), following: z.number().int() }).strict(),
          venues: z.array(VenueRef),
        })
        .strict(),
      relationship: Relationship,
      /** null = not visible to you (plans are shared with mutual follows only). */
      goingTonight: z.array(VenueRef).nullable(),
      /** "Regular at ___": 3+ nights with posts there in the last 60 days. */
      regularAt: z.array(VenueRef),
      /** "Featured at Lantern & Lark, October": month is YYYY-MM, newest first. */
      featured: z.array(z.object({ venue: VenueRef, month: z.string(), count: z.number().int() }).strict()),
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
  .object({
    following: z.array(
      z.object({ handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), verified: z.boolean(), mutual: z.boolean(), goingTonight: z.array(VenueRef) }).strict(),
    ),
  })
  .strict();
/** PUT follow: public account -> "following"; private account -> "requested". DELETE (unfollow or cancel) -> "none". */
export const FollowResponse = z.object({ state: FollowState }).strict();
const PostRef = z.object({ id: z.string(), url: z.string(), venue: VenueRef }).strict();
/** GET /api/me/activity: newest first, last 30 days (pending requests of any age). In-app only. */
export const ActivityResponse = z
  .object({
    items: z.array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("follow_request"), at: IsoDate, person: PersonView }).strict(),
        z.object({ kind: z.literal("new_follower"), at: IsoDate, person: PersonView }).strict(),
        z.object({ kind: z.literal("like"), at: IsoDate, person: PersonView, post: PostRef }).strict(),
        /** "You were featured at ___". */
        z.object({ kind: z.literal("featured"), at: IsoDate, night: z.string(), post: PostRef }).strict(),
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
/**
 * Your blocks. `handle` is null for blocks made from a photo or comment (`source`), whose author may have been
 * Anonymous to you: show "Someone you blocked from a photo". Unblock with DELETE /api/me/blocks/:ref.
 */
export const BlocksResponse = z
  .object({ blocks: z.array(z.object({ ref: z.string(), source: z.enum(["profile", "photo", "comment"]), handle: z.string().nullable(), blockedAt: IsoDate }).strict()) })
  .strict();
/** POST /api/blocks: block the author of a photo or comment without learning who it is. */
export const BlockAuthorRequest = z.object({ targetType: z.enum(["PHOTO", "COMMENT"]), targetId: z.string().min(1).max(64) }).strict();

// ------------------------------------------------------------------------------------------------
// Flags and moderation
// ------------------------------------------------------------------------------------------------

/** targetId: content id; for USER, the account id or handle. */
export const FlagRequest = z.object({ targetType: ContentType, targetId: z.string().min(1).max(64), reason: z.string().trim().min(3).max(300) }).strict();
export const FlagResponse = z.object({ flag: z.object({ id: z.string() }).strict(), autoHidden: z.boolean() }).strict();
export const ModActionRequest = z
  .object({ targetType: ContentType, targetId: z.string().min(1).max(64), action: z.enum(["HIDE", "DISMISS", "RESTORE", "SUSPEND", "UNSUSPEND"]), note: z.string().trim().max(300).optional() })
  .strict();
export const ModActionResponse = z.object({ target: z.object({ id: z.string(), hidden: z.boolean() }).strict().nullable() }).strict();
export const ModQueueItem = z
  .object({
    targetType: ContentType,
    targetId: z.string(),
    /** null for USER (account) reports. */
    venue: VenueRef.nullable(),
    content: z
      .object({
        kind: ContentType,
        preview: z.string(),
        /** Signed URL for photos (moderators can see hidden ones). */
        url: z.string().optional(),
        author: z.string(),
        authorRep: z.number(),
        /** Hidden (content) or suspended (account) time. */
        hiddenAt: IsoDate.nullable(),
        createdAt: IsoDate,
      })
      .strict()
      .nullable(),
    flags: z.array(
      z
        .object({ id: z.string(), reason: z.string(), createdAt: IsoDate, by: z.string(), byRole: Role, byVenueOwner: z.boolean(), byOtherVenueOwner: z.boolean() })
        .strict(),
    ),
    history: z.array(z.object({ action: ModerationAction, by: z.string(), note: z.string().nullable(), at: IsoDate }).strict()),
  })
  .strict();
export const ModQueueResponse = z.object({ items: z.array(ModQueueItem) }).strict();
/** Hidden content and suspended accounts (newest first) for the Restore / Unsuspend screen. */
export const ModHiddenResponse = z
  .object({
    items: z.array(
      z
        .object({ targetType: ContentType, targetId: z.string(), venue: VenueRef.nullable(), preview: z.string(), url: z.string().optional(), author: z.string(), hiddenAt: IsoDate })
        .strict(),
    ),
  })
  .strict();
export const ModLogResponse = z
  .object({
    events: z.array(
      z.object({ id: z.string(), action: ModerationAction, targetType: ContentType, targetId: z.string(), by: z.string(), note: z.string().nullable(), createdAt: IsoDate }).strict(),
    ),
  })
  .strict();

// ------------------------------------------------------------------------------------------------
// Venue owners
// ------------------------------------------------------------------------------------------------

export const PromoView = z.object({ id: z.string(), title: z.string(), body: z.string(), isPaid: z.boolean(), startsAt: IsoDate, endsAt: IsoDate }).strict();
export const OwnerOverviewResponse = z
  .object({
    venues: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() }).strict()),
    claims: z.array(z.object({ id: z.string(), venueName: z.string(), status: ClaimStatus, createdAt: IsoDate }).strict()),
  })
  .strict();
export const OwnerDashboardResponse = z
  .object({
    venue: z
      .object({
        id: z.string(), slug: z.string(), name: z.string(), address: z.string(), hours: z.array(HoursEntry),
        officialCoverCents: z.number().int().nullable(), dressCode: z.string().nullable(), officialPhotoUrl: z.string().nullable(),
      })
      .strict(),
    page: VenuePageResponse,
    promos: z.array(PromoView),
    coverHistory: z.array(z.object({ id: z.string(), coverCents: z.number().int().nullable(), effectiveFrom: IsoDate }).strict()),
    accuracy: Accuracy,
    /** Anonymous by design: no reporter identity. */
    recentReports: z.array(
      z.object({ id: z.string(), type: ReportType, vibe: Vibe.nullable(), line: LineWait.nullable(), coverCents: z.number().int().nullable(), createdAt: IsoDate }).strict(),
    ),
    hiddenReplies: z.array(z.object({ id: z.string(), body: z.string(), hiddenAt: IsoDate.nullable() }).strict()),
  })
  .strict();
/** PATCH: send only fields that changed. officialCover: "free", dollars ("15"), or "" for not stated. */
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const OfficialInfoRequest = z
  .object({
    name: z.string().trim().min(2).max(80),
    address: z.string().trim().max(120),
    hours: z
      .array(z.object({ day: z.number().int().min(0).max(6), open: HHMM, close: HHMM }).strict())
      .max(7)
      .refine((h) => new Set(h.map((x) => x.day)).size === h.length, "One entry per day"),
    officialCover: z.string().trim().max(10),
    dressCode: z.string().trim().max(120),
  })
  .partial()
  .strict();
export const OfficialInfoResponse = z.object({ venue: z.object({ id: z.string(), officialCoverCents: z.number().int().nullable() }).strict() }).strict();
export const OfficialPhotoResponse = z.object({ officialPhotoUrl: z.string().nullable() }).strict();
/** startsAt/endsAt: New York wall-clock "YYYY-MM-DDTHH:MM". */
const NyLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const PromoRequest = z.object({ title: z.string().trim().min(3).max(80), body: z.string().trim().min(3).max(400), startsAt: NyLocal, endsAt: NyLocal }).strict();
export const PromoResponse = z.object({ promo: PromoView }).strict();
export const ClaimRequest = z.object({ venueId: z.string().min(1) }).strict();
export const ClaimResponse = z.object({ claim: z.object({ id: z.string(), status: ClaimStatus }).strict() }).strict();

// ------------------------------------------------------------------------------------------------
// Admin (web only; not used by the iOS app)
// ------------------------------------------------------------------------------------------------

export const AdminClaimResponse = ClaimResponse;
export const AdminPromoResponse = PromoResponse;
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

export const CronResponse = z
  .object({
    ok: z.literal(true), updated: z.number().int(), judged: z.number().int(), skipped: z.boolean(),
    prunedLoginAttempts: z.number().int(), prunedPresence: z.number().int(), ms: z.number(),
  })
  .strict();

/**
 * POST /api/cron/featured. `nights` = the nights featured by this run; `skipped` = another run was processing a night;
 * `failed` = nights that errored (the next run retries them).
 */
export const FeaturedCronResponse = z
  .object({ ok: z.literal(true), nights: z.array(z.string()), featured: z.number().int(), skipped: z.boolean(), failed: z.array(z.string()), ms: z.number() })
  .strict();

export const HealthResponse = z
  .object({ ok: z.literal(true), db: z.literal("up"), env: z.string(), commit: z.string().nullable(), ms: z.number() })
  .strict();

// ------------------------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------------------------

export type ErrorResponse = z.infer<typeof ErrorResponse>;
export type Attribution = z.infer<typeof Attribution>;
export type PublicUser = z.infer<typeof PublicUser>;
export type Vibe = z.infer<typeof Vibe>;
export type VibeState = z.infer<typeof VibeState>;
export type LineWait = z.infer<typeof LineWait>;
export type Role = z.infer<typeof Role>;
export type ContentType = z.infer<typeof ContentType>;
export type Accuracy = z.infer<typeof Accuracy>;
export type AuthorView = z.infer<typeof AuthorView>;
export type FollowState = z.infer<typeof FollowState>;
export type PersonView = z.infer<typeof PersonView>;
export type PersonRow = z.infer<typeof PersonRow>;
export type Relationship = z.infer<typeof Relationship>;
export type PostView = z.infer<typeof PostView>;
export type LikeSummary = z.infer<typeof LikeSummary>;
export type FeaturedPhotoView = z.infer<typeof FeaturedPhotoView>;
export type FeaturedMonthResponse = z.infer<typeof FeaturedMonthResponse>;
export type ActivityResponse = z.infer<typeof ActivityResponse>;
export type PostTile = z.infer<typeof PostTile>;
export type PostEditRequest = z.infer<typeof PostEditRequest>;
export type UserPostsResponse = z.infer<typeof UserPostsResponse>;
export type UserPlacesResponse = z.infer<typeof UserPlacesResponse>;
export type PeopleListResponse = z.infer<typeof PeopleListResponse>;
export type FollowRequestsResponse = z.infer<typeof FollowRequestsResponse>;
export type ProfileSettingsRequest = z.infer<typeof ProfileSettingsRequest>;
export type ProfileSettingsResponse = z.infer<typeof ProfileSettingsResponse>;
export type SignupRequest = z.infer<typeof SignupRequest>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type TokenResponse = z.infer<typeof TokenResponse>;
export type MeResponse = z.infer<typeof MeResponse>;
export type MapVenue = z.infer<typeof MapVenue>;
export type VenuesResponse = z.infer<typeof VenuesResponse>;
export type PhotoView = z.infer<typeof PhotoView>;
export type CommentView = z.infer<typeof CommentView>;
export type VenuePageResponse = z.infer<typeof VenuePageResponse>;
export type ReportRequest = z.infer<typeof ReportRequest>;
export type ReportResponse = z.infer<typeof ReportResponse>;
export type PhotoResponse = z.infer<typeof PhotoResponse>;
export type PresenceResponse = z.infer<typeof PresenceResponse>;
export type RsvpResponse = z.infer<typeof RsvpResponse>;
export type ProfileResponse = z.infer<typeof ProfileResponse>;
export type FollowingResponse = z.infer<typeof FollowingResponse>;
export type BlocksResponse = z.infer<typeof BlocksResponse>;
export type UserSearchResponse = z.infer<typeof UserSearchResponse>;
export type FlagRequest = z.infer<typeof FlagRequest>;
export type ModQueueItem = z.infer<typeof ModQueueItem>;
export type ModQueueResponse = z.infer<typeof ModQueueResponse>;
export type OwnerOverviewResponse = z.infer<typeof OwnerOverviewResponse>;
export type OwnerDashboardResponse = z.infer<typeof OwnerDashboardResponse>;
export type OfficialInfoRequest = z.infer<typeof OfficialInfoRequest>;
export type PromoRequest = z.infer<typeof PromoRequest>;
export type PromoView = z.infer<typeof PromoView>;
