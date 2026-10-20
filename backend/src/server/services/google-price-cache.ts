import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";

import type { PriceTier } from "@/lib/category-stamp-design";
import type { Db } from "@/lib/db";
import type { GooglePriceLevel } from "@/server/services/google-places";

type CacheDb = Db | PrismaTypes.TransactionClient;
type CacheRow = { venue_id: string; price_level: string };

const PRICE: Record<string, PriceTier | null> = {
  PRICE_LEVEL_UNSPECIFIED: null,
  PRICE_LEVEL_FREE: null,
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

export function priceTierForGoogleLevel(level: string | null | undefined): PriceTier | null {
  return level ? PRICE[level] ?? null : null;
}

export async function cachedGooglePrice(db: CacheDb, venueId: string): Promise<{ cached: boolean; priceTier: PriceTier | null }> {
  const rows = await db.$queryRaw<CacheRow[]>`
    SELECT venue_id, price_level
    FROM google_place_price_cache
    WHERE venue_id = ${venueId}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { cached: true, priceTier: priceTierForGoogleLevel(row.price_level) } : { cached: false, priceTier: null };
}

export async function cachedGooglePrices(db: CacheDb, venueIds: readonly string[]): Promise<Map<string, PriceTier | null>> {
  const ids = [...new Set(venueIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await db.$queryRaw<CacheRow[]>(Prisma.sql`
    SELECT venue_id, price_level
    FROM google_place_price_cache
    WHERE venue_id IN (${Prisma.join(ids)})
  `);
  return new Map(rows.map((row) => [row.venue_id, priceTierForGoogleLevel(row.price_level)]));
}

export async function cacheGooglePrice(db: CacheDb, venueId: string, level: GooglePriceLevel | null): Promise<PriceTier | null> {
  const stored = level ?? "PRICE_LEVEL_UNSPECIFIED";
  await db.$executeRaw`
    INSERT INTO google_place_price_cache (venue_id, price_level)
    VALUES (${venueId}, ${stored})
    ON CONFLICT (venue_id) DO NOTHING
  `;
  return priceTierForGoogleLevel(stored);
}
