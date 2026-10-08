/**
 * COPIED VERBATIM from backend/src/contracts/api.ts.
 */
import { z } from "zod";

export const IsoDate = z.string().datetime({ offset: true });
export const ErrorResponse = z.object({ error: z.string(), message: z.string() }).strict();
export const Attribution = z.object({ text: z.literal("© OpenStreetMap contributors"), url: z.string().url(), license: z.literal("ODbL-1.0") }).strict();
export const PlaceRef = z.object({ id: z.string(), slug: z.string(), name: z.string(), neighborhood: z.string(), neighborhoodId: z.string().nullable() }).strict();

const EmailAddress = z.string().trim().toLowerCase().email().max(200);
const VerificationCode = z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code");
const ChallengeId = z.string().uuid();
const DisplayName = z.string().trim().min(1).max(60);
const SignupHandle = z.string().trim().toLowerCase().min(3, "Handle must be at least 3 characters").max(30, "Handle must be 30 characters or fewer").regex(/^[a-z0-9._]+$/, "Handle can use lowercase letters, numbers, periods and underscores");
const LoginIdentifier = z.string().trim().toLowerCase().min(1).max(200);
const Birthdate = z.string().refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}, "Enter your birthdate as YYYY-MM-DD");

export const PublicUser = z.object({ id: z.string(), handle: z.string(), displayName: z.string() }).strict();
export const EmailChallengeResponse = z.object({ challengeId: ChallengeId, expiresAt: IsoDate, resendAfterSeconds: z.number().int().nonnegative() }).strict();
export const SignupStartRequest = z.object({ email: EmailAddress, displayName: DisplayName, handle: SignupHandle, birthdate: Birthdate, acceptTerms: z.literal(true) }).strict();
export const SignupRequest = z.object({ challengeId: ChallengeId, code: VerificationCode, displayName: DisplayName, handle: SignupHandle, acceptTerms: z.literal(true) }).strict();
export const LoginStartRequest = z.union([z.object({ email: EmailAddress }).strict(), z.object({ identifier: LoginIdentifier }).strict()]);
export const LoginRequest = z.object({ challengeId: ChallengeId, code: VerificationCode }).strict();
export const TokenResponse = z.object({ token: z.string(), expiresAt: IsoDate, user: PublicUser }).strict();
export const WebAuthResponse = z.object({ user: PublicUser }).strict();
export const OkResponse = z.object({ ok: z.literal(true) }).strict();
export const LogoutAllResponse = z.object({ ok: z.literal(true), revoked: z.number().int() }).strict();

export const MeResponse = z.object({
  user: z.object({ id: z.string(), email: z.string(), handle: z.string(), displayName: z.string(), memberSince: IsoDate, bio: z.string(), avatarUrl: z.string().nullable() }).strict(),
  settings: z.object({ geofenceExempt: z.boolean() }).strict(),
  terms: z.object({ acceptedVersion: z.string().nullable(), acceptedAt: IsoDate.nullable(), currentVersion: z.string(), needsAcceptance: z.boolean() }).strict(),
}).strict();
export const AcceptTermsRequest = z.object({ version: z.string() }).strict();
export const AcceptTermsResponse = z.object({ acceptedVersion: z.string(), acceptedAt: IsoDate }).strict();
export const EmailChangeStartRequest = z.object({ email: EmailAddress }).strict();
export const EmailChangeRequest = z.object({ challengeId: ChallengeId, code: VerificationCode }).strict();
export const EmailChangeResponse = z.object({ ok: z.literal(true), email: EmailAddress }).strict();
export const DeleteAccountRequest = z.object({ challengeId: ChallengeId, code: VerificationCode }).strict();
export const DeleteAccountResponse = z.object({ deleted: z.literal(true) }).strict();

export const Place = z.object({
  id: z.string(), slug: z.string(), name: z.string(), address: z.string(), neighborhood: z.string(), lat: z.number(), lng: z.number(), geofenceMeters: z.number().int(), neighborhoodId: z.string().nullable(), fromOsm: z.boolean(),
}).strict();
export const PlacesResponse = z.object({ places: z.array(Place), attribution: Attribution.nullable() }).strict();
export const PlaceResponse = z.object({ place: Place }).strict();
export const NearbyPlacesResponse = z.object({ places: z.array(Place.extend({ distanceM: z.number().int(), inside: z.boolean() }).strict()) }).strict();

export const AppleArtUrl = z.string().trim().max(500).refine((u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && /(^|\.)mzstatic\.com$/.test(url.hostname);
  } catch { return false; }
}, "Song art must be an https link from Apple's artwork servers");
export const Song = z.object({ title: z.string(), artist: z.string(), artUrl: z.string().nullable(), sourceId: z.string().nullable() }).strict();
export const StampPhotoView = z.object({ id: z.string(), url: z.string(), position: z.number().int().min(0).max(5), x: z.number().nullable(), y: z.number().nullable(), rotation: z.number().nullable() }).strict();
export const StampView = z.object({
  id: z.string(),
  photoUrl: z.string().nullable(),
  photos: z.array(StampPhotoView).max(6),
  caption: z.string(),
  song: Song.nullable(),
  page: z.number().int().min(1).nullable(),
  slot: z.number().int().min(1).max(3).nullable(),
  createdAt: IsoDate,
  visitedAt: IsoDate,
  verifiedAt: IsoDate.nullable(),
  verified: z.boolean(),
  editedAt: IsoDate.nullable(),
  place: PlaceRef,
}).strict();
export const StampResponse = z.object({ stamp: StampView }).strict();
export const NeighborhoodProgress = z.object({ neighborhoodId: z.string(), name: z.string(), borough: z.string(), visited: z.number().int(), total: z.number().int(), complete: z.boolean(), justCompleted: z.boolean(), newPlace: z.boolean() }).strict();
export const CreateStampResponse = z.object({ stamp: StampView, progress: NeighborhoodProgress.nullable() }).strict();
export const NeighborhoodIndexResponse = z.object({ neighborhoods: z.array(z.object({ neighborhoodId: z.string(), name: z.string(), borough: z.string(), visited: z.number().int(), total: z.number().int(), complete: z.boolean(), completedAt: IsoDate.nullable(), percent: z.number().int() }).strict()), totals: z.object({ neighborhoodsStarted: z.number().int(), neighborhoodsComplete: z.number().int() }).strict() }).strict();
export const StampEditRequest = z.object({
  caption: z.string().trim().max(280),
  song: z.object({ title: z.string().trim().min(1).max(200), artist: z.string().trim().min(1).max(200), artUrl: AppleArtUrl.nullish(), sourceId: z.string().trim().min(1).max(100).nullish() }).strict().nullable(),
  visitedAt: IsoDate,
}).partial().strict().refine((v) => Object.keys(v).length > 0, "Nothing to change");
export const PhotoLayoutRequest = z.object({ photos: z.array(z.object({ id: z.string().min(1).max(64), position: z.number().int().min(0).max(5).optional(), x: z.number().min(0).max(1).nullable().optional(), y: z.number().min(0).max(1).nullable().optional(), rotation: z.number().min(-45).max(45).nullable().optional() }).strict()).min(1).max(6) }).strict();
export const PinsRequest = z.object({ stampIds: z.array(z.string().min(1).max(64)).max(4) }).strict();
export const PinsResponse = z.object({ stamps: z.array(StampView).max(4) }).strict();
export const RemoveStampResponse = z.object({ removed: z.literal(true) }).strict();
export const UserStampsResponse = z.object({ stamps: z.array(StampView), nextAfter: z.string().nullable() }).strict();
export const UserPlacesResponse = z.object({ places: z.array(z.object({ place: z.object({ id: z.string(), slug: z.string(), name: z.string(), neighborhood: z.string(), lat: z.number(), lng: z.number() }).strict(), stamps: z.number().int(), latestStamp: z.object({ id: z.string(), createdAt: IsoDate, visitedAt: IsoDate, photoUrl: z.string().nullable(), caption: z.string() }).strict() }).strict()) }).strict();
export const SongResult = z.object({ title: z.string(), artist: z.string(), album: z.string().nullable(), artUrl: z.string().nullable(), sourceId: z.string() }).strict();
export const SongSearchResponse = z.object({ songs: z.array(SongResult) }).strict();
export const MyPlacePageResponse = z.object({ place: Place.omit({ fromOsm: true }).extend({ fromOsm: z.boolean() }).strict(), stamps: z.array(StampView), visits: z.array(z.object({ day: z.string(), stamps: z.array(StampView) }).strict()), inside: z.boolean().nullable(), distanceM: z.number().int().nullable() }).strict();

export const ProfileSettingsRequest = z.object({ displayName: z.string().trim().min(1).max(60), bio: z.string().trim().max(150) }).partial().strict();
export const ProfileSettingsResponse = z.object({ profile: z.object({ handle: z.string(), displayName: z.string(), bio: z.string(), avatarUrl: z.string().nullable() }).strict() }).strict();
export const AvatarResponse = z.object({ avatarUrl: z.string().nullable() }).strict();

export const CronResponse = z.object({ ok: z.literal(true), prunedLoginAttempts: z.number().int(), prunedRateEvents: z.number().int(), ms: z.number() }).strict();
export const HealthResponse = z.object({ ok: z.literal(true), db: z.literal("up"), env: z.string(), commit: z.string().nullable(), ms: z.number() }).strict();

export type ErrorResponse = z.infer<typeof ErrorResponse>;
export type Attribution = z.infer<typeof Attribution>;
export type PublicUser = z.infer<typeof PublicUser>;
export type PlaceRef = z.infer<typeof PlaceRef>;
export type Place = z.infer<typeof Place>;
export type PlacesResponse = z.infer<typeof PlacesResponse>;
export type NearbyPlacesResponse = z.infer<typeof NearbyPlacesResponse>;
export type Song = z.infer<typeof Song>;
export type NeighborhoodProgress = z.infer<typeof NeighborhoodProgress>;
export type NeighborhoodIndexResponse = z.infer<typeof NeighborhoodIndexResponse>;
export type StampView = z.infer<typeof StampView>;
export type StampPhotoView = z.infer<typeof StampPhotoView>;
export type PhotoLayoutRequest = z.infer<typeof PhotoLayoutRequest>;
export type StampResponse = z.infer<typeof StampResponse>;
export type StampEditRequest = z.infer<typeof StampEditRequest>;
export type UserStampsResponse = z.infer<typeof UserStampsResponse>;
export type UserPlacesResponse = z.infer<typeof UserPlacesResponse>;
export type SongResult = z.infer<typeof SongResult>;
export type SongSearchResponse = z.infer<typeof SongSearchResponse>;
export type ProfileSettingsRequest = z.infer<typeof ProfileSettingsRequest>;
export type ProfileSettingsResponse = z.infer<typeof ProfileSettingsResponse>;
export type EmailChallengeResponse = z.infer<typeof EmailChallengeResponse>;
export type SignupStartRequest = z.infer<typeof SignupStartRequest>;
export type SignupRequest = z.infer<typeof SignupRequest>;
export type LoginStartRequest = z.infer<typeof LoginStartRequest>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type EmailChangeStartRequest = z.infer<typeof EmailChangeStartRequest>;
export type EmailChangeRequest = z.infer<typeof EmailChangeRequest>;
export type EmailChangeResponse = z.infer<typeof EmailChangeResponse>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequest>;
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponse>;
export type TokenResponse = z.infer<typeof TokenResponse>;
export type MeResponse = z.infer<typeof MeResponse>;
export type MyPlacePageResponse = z.infer<typeof MyPlacePageResponse>;
export type PinsResponse = z.infer<typeof PinsResponse>;
export type CreateStampResponse = z.infer<typeof CreateStampResponse>;
