import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";

import type { PriceTier } from "@/lib/category-stamp-design";
import type { Db } from "@/lib/db";
import type { GooglePriceLevel } from "@/server/services/google-places";

type CacheDb = Db | PrismaTypes.TransactionClient;
type CacheRow = { venue_id: string; price_level: string | null; checked_at: Date | null };

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
    SELECT id AS venue_id, google_price_level AS price_level, google_price_checked_at AS checked_at
    FROM venue
    WHERE id = ${venueId}
    LIMIT 1
  `;
  const row = rows[0];
  return row?.checked_at
    ? { cached: true, priceTier: priceTierForGoogleLevel(row.price_level) }
    : { cached: false, priceTier: null };
}

export async function cachedGooglePrices(db: CacheDb, venueIds: readonly string[]): Promise<Map<string, PriceTier | null>> {
  const ids = [...new Set(venueIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await db.$queryRaw<CacheRow[]>(Prisma.sql`
    SELECT id AS venue_id, google_price_level AS price_level, google_price_checked_at AS checked_at
    FROM venue
    WHERE id IN (${Prisma.join(ids)})
  `);
  return new Map(rows.map((row) => [row.venue_id, priceTierForGoogleLevel(row.price_level)]));
}

export async function cacheGooglePrice(db: CacheDb, venueId: string, level: GooglePriceLevel | null): Promise<PriceTier | null> {
  await db.$executeRaw`
    UPDATE venue
    SET google_price_level = ${level}, google_price_checked_at = CURRENT_TIMESTAMP
    WHERE id = ${venueId} AND google_price_checked_at IS NULL
  `;
  return priceTierForGoogleLevel(level);
}
