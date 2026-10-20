import type { Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";

import type { Db } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";
import type { MichelinStars } from "@/lib/michelin-stamp";

const ALGOLIA_URL = "https://8nvhrd7onv-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(5.47.0)%3B%20Lite%20(5.47.0)%3B%20Browser&x-algolia-api-key=3222e669cf890dc73fa5f38241117ba5&x-algolia-application-id=8NVHRD7ONV";
const MICHELIN_REFERRER = "https://guide.michelin.com/us/en/restaurants/3-stars-michelin";
const MICHELIN_ORIGIN = "https://guide.michelin.com";
const MICHELIN_TIMEOUT_MS = 2_500;

type MichelinDb = Db | PrismaTypes.TransactionClient;
type MichelinPlace = {
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

export async function ensureMichelinForStamp(db: Db, place: MichelinPlace): Promise<void> {
  if (place.category !== "restaurant") {
    logMichelin("skip", { venueId: place.id, name: place.name, reason: `category=${place.category ?? "null"}` });
    return;
  }
  try {
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CacheRow[]>`
        SELECT michelin_stars, michelin_checked_at
        FROM venue
        WHERE id = ${place.id}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) {
        logMichelin("skip", { venueId: place.id, name: place.name, reason: "venue row missing" });
        return;
      }
      if (row.michelin_checked_at) {
        logMichelin("cache hit", {
          venueId: place.id,
          name: place.name,
          stars: row.michelin_stars,
          checkedAt: row.michelin_checked_at.toISOString(),
        });
        return;
      }
      const stars = await lookupMichelinStars(place);
      await tx.$executeRaw`
        UPDATE venue
        SET michelin_stars = ${stars}, michelin_checked_at = CURRENT_TIMESTAMP
        WHERE id = ${place.id} AND michelin_checked_at IS NULL
      `;
      logMichelin("cached", { venueId: place.id, name: place.name, stars });
    });
  } catch (error) {
    logMichelin("failed", {
      venueId: place.id,
      name: place.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
