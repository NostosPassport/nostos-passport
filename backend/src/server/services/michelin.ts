import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";

import type { Db } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";
import type { MichelinStars } from "@/lib/michelin-stamp";

const ALGOLIA_URL = "https://8nvhrd7onv-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(5.47.0)%3B%20Lite%20(5.47.0)%3B%20Browser&x-algolia-api-key=3222e669cf890dc73fa5f38241117ba5&x-algolia-application-id=8NVHRD7ONV";
const MICHELIN_REFERRER = "https://guide.michelin.com/us/en/restaurants/3-stars-michelin";
const MICHELIN_ORIGIN = "https://guide.michelin.com";
const MICHELIN_TIMEOUT_MS = 2_500;
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const PREVIEW_PATTERN = /^mp1\.([0-3])\.(\d{13})\.([A-Za-z0-9_-]{43})$/;

type MichelinDb = Db | PrismaTypes.TransactionClient;
export type MichelinPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  category: "restaurant" | "bar" | null;
};
type CacheRow = { michelin_stars: number | null; michelin_checked_at: Date | null };

const hitSchema = z.object({
  name: z.string(),
  _geoloc: z.object({ lat: z.number(), lng: z.number() }).optional(),
  michelin_award: z.unknown().optional(),
  distinction: z.unknown().optional(),
}).passthrough();
const responseSchema = z.object({
  results: z.array(z.object({ hits: z.array(hitSchema).default([]) }).passthrough()).min(1),
}).passthrough();

type MichelinHit = z.infer<typeof hitSchema>;

function logMichelin(message: string, details?: unknown) {
  if (process.env.NODE_ENV === "production") return;
  if (details === undefined) console.info(`[michelin] ${message}`);
  else console.info(`[michelin] ${message}`, details);
}

function previewSecret() {
  const value = process.env.SHARE_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("SHARE_TOKEN_SECRET must be at least 32 characters");
  return value;
}

function previewSignature(venueId: string, stars: number, expiresAt: number) {
  return createHmac("sha256", previewSecret())
    .update(`michelin-preview:v1:${venueId}:${stars}:${expiresAt}`)
    .digest("base64url");
}

function createPreviewProof(venueId: string, stars: MichelinStars | null, now = Date.now()) {
  const encodedStars = stars ?? 0;
  const expiresAt = now + PREVIEW_TTL_MS;
  return `mp1.${encodedStars}.${expiresAt}.${previewSignature(venueId, encodedStars, expiresAt)}`;
}

export function verifyMichelinPreviewProof(venueId: string, proof: string | null | undefined, now = Date.now()): MichelinStars | null | undefined {
  if (!proof) return undefined;
  const match = PREVIEW_PATTERN.exec(proof);
  if (!match) return undefined;
  const stars = Number(match[1]);
  const expiresAt = Number(match[2]);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return undefined;
  const actual = Buffer.from(match[3]!, "utf8");
  const expected = Buffer.from(previewSignature(venueId, stars, expiresAt), "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  return stars === 1 || stars === 2 || stars === 3 ? stars : null;
}

const normalizeName = (value: string) => value
  .normalize("NFKD")
  .replace(/\p{Mark}/gu, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

function awardText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try { return JSON.stringify(value); } catch { return ""; }
}

export function michelinStarsFromHit(hit: Pick<MichelinHit, "michelin_award" | "distinction">): MichelinStars | null {
  const raw = `${awardText(hit.michelin_award)} ${awardText(hit.distinction)}`.toLowerCase();
  if (!raw) return null;
  const numeric = raw.match(/(?:^|\D)([123])(?:\s|_|-)*(?:michelin(?:\s|_|-)*)?stars?\b/) ?? raw.match(/(?:^|\D)([123])(?:\s|_|-)*stars?(?:\s|_|-)*michelin\b/);
  if (numeric) return Number(numeric[1]) as MichelinStars;
  if (/\bthree\s+stars?\b/.test(raw)) return 3;
  if (/\btwo\s+stars?\b/.test(raw)) return 2;
  if (/\bone\s+star\b/.test(raw) || /\bmichelin(?:\s|_|-)*star\b/.test(raw)) return 1;
  return null;
}

function candidateDistance(place: MichelinPlace, hit: MichelinHit) {
  if (!hit._geoloc) return Number.POSITIVE_INFINITY;
  return distanceMeters(place, { lat: hit._geoloc.lat, lng: hit._geoloc.lng });
}

function confidentMatch(place: MichelinPlace, hit: MichelinHit) {
  const expected = normalizeName(place.name);
  const actual = normalizeName(hit.name);
  const distance = candidateDistance(place, hit);
  if (!expected || !actual || !Number.isFinite(distance)) return false;
  if (expected === actual) return distance <= 350;
  const contains = Math.min(expected.length, actual.length) >= 6 && (expected.includes(actual) || actual.includes(expected));
  return contains && distance <= 75;
}

export async function lookupMichelinStars(place: MichelinPlace, fetchImpl: typeof fetch = fetch): Promise<MichelinStars | null> {
  logMichelin("request", { venueId: place.id, name: place.name });
  const response = await fetchImpl(ALGOLIA_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "text/plain",
      origin: MICHELIN_ORIGIN,
      referer: MICHELIN_REFERRER,
    },
    referrer: MICHELIN_REFERRER,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: JSON.stringify({
      requests: [{
        indexName: "prod-restaurants-en",
        analytics: false,
        clickAnalytics: false,
        attributesToHighlight: [],
        attributesToRetrieve: ["_geoloc", "city", "country", "identifier", "michelin_award", "name", "slug", "distinction"],
        filters: "status:Published",
        getRankingInfo: true,
        hitsPerPage: 8,
        page: 0,
        query: place.name,
        aroundLatLng: `${place.lat},${place.lng}`,
        aroundRadius: 1500,
      }],
    }),
    signal: AbortSignal.timeout(MICHELIN_TIMEOUT_MS),
    credentials: "omit",
    redirect: "error",
  });
  logMichelin("response", { venueId: place.id, name: place.name, status: response.status });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logMichelin("response error", {
      venueId: place.id,
      name: place.name,
      status: response.status,
      body: body.slice(0, 500),
    });
    throw new Error(`Michelin search ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Unexpected Michelin search response");
  const match = parsed.data.results[0]!.hits
    .filter((hit) => confidentMatch(place, hit))
    .sort((a, b) => candidateDistance(place, a) - candidateDistance(place, b))[0];
  const stars = match ? michelinStarsFromHit(match) : null;
  logMichelin("result", {
    venueId: place.id,
    name: place.name,
    matchedName: match?.name ?? null,
    distanceM: match ? Math.round(candidateDistance(place, match)) : null,
    stars,
  });
  return stars;
}

export async function cachedMichelinStars(db: MichelinDb, venueId: string): Promise<MichelinStars | null> {
  const rows = await db.$queryRaw<CacheRow[]>`
    SELECT michelin_stars, michelin_checked_at
    FROM venue
    WHERE id = ${venueId}
    LIMIT 1
  `;
  const stars = rows[0]?.michelin_stars;
  return stars === 1 || stars === 2 || stars === 3 ? stars : null;
}

export async function previewMichelinForPlace(db: Db, place: MichelinPlace) {
  if (place.category !== "restaurant") {
    logMichelin("preview skip", { venueId: place.id, name: place.name, reason: `category=${place.category ?? "null"}` });
    return { venueId: place.id, stars: null, proof: null };
  }

  const rows = await db.$queryRaw<CacheRow[]>`
    SELECT michelin_stars, michelin_checked_at
    FROM venue
    WHERE id = ${place.id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { venueId: place.id, stars: null, proof: null };
  if (row.michelin_checked_at) {
    const stars = row.michelin_stars === 1 || row.michelin_stars === 2 || row.michelin_stars === 3 ? row.michelin_stars : null;
    logMichelin("cache hit", { venueId: place.id, name: place.name, stars, checkedAt: row.michelin_checked_at.toISOString() });
    return { venueId: place.id, stars, proof: null };
  }

  try {
    const stars = await lookupMichelinStars(place);
    const proof = createPreviewProof(place.id, stars);
    logMichelin("preview ready", { venueId: place.id, name: place.name, stars });
    return { venueId: place.id, stars, proof };
  } catch (error) {
    logMichelin("preview failed", {
      venueId: place.id,
      name: place.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return { venueId: place.id, stars: null, proof: null };
  }
}

export async function cacheMichelinPreviewForStamp(db: Db, place: MichelinPlace, proof: string | null | undefined): Promise<void> {
  if (place.category !== "restaurant") return;
  const stars = verifyMichelinPreviewProof(place.id, proof);
  if (stars === undefined) {
    logMichelin("stamp cache skip", { venueId: place.id, name: place.name, reason: proof ? "invalid or expired preview proof" : "no preview proof" });
    return;
  }

  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<CacheRow[]>`
      SELECT michelin_stars, michelin_checked_at
      FROM venue
      WHERE id = ${place.id}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.michelin_checked_at) return;
    await tx.$executeRaw`
      UPDATE venue
      SET michelin_stars = ${stars}, michelin_checked_at = CURRENT_TIMESTAMP
      WHERE id = ${place.id} AND michelin_checked_at IS NULL
    `;
    logMichelin("cached on stamp", { venueId: place.id, name: place.name, stars });
  });
}
