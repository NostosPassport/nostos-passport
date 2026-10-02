/**
 * pnpm venues:import [--dry-run] [--file overpass.json] [--allow-demo]
 * Pulls bars, pubs and nightclubs in the East Village + LES from the OpenStreetMap Overpass API and upserts them
 * (idempotent on osm_id). Data © OpenStreetMap contributors, ODbL. Uses DATABASE_URL (run against production with
 * the production env loaded; see DEPLOY.md).
 */
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { overpassQuery, parseOverpass, type OverpassElement } from "../src/lib/osm";
import { importOsmVenues } from "../src/server/services/osm-import";

if (existsSync(".env")) process.loadEnvFile(".env");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileIdx = args.indexOf("--file");
const endpoint = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

async function fetchElements(): Promise<OverpassElement[]> {
  if (fileIdx >= 0) return (JSON.parse(readFileSync(args[fileIdx + 1]!, "utf8")) as { elements: OverpassElement[] }).elements;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Nostos-venue-import/1.0 (support@REPLACE-ME)" },
    body: new URLSearchParams({ data: overpassQuery() }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  let body: { elements?: OverpassElement[]; remark?: string };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // Overload/rate limiting comes back as an XML/HTML error page.
    throw new Error(`Overpass returned a non-JSON response (busy or rate-limited?): ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  // Overpass reports timeouts/overload as HTTP 200 with a "remark" and partial (or empty) elements.
  if (body.remark && /error|timed out|out of memory|runtime/i.test(body.remark)) throw new Error(`Overpass failed: ${body.remark}`);
  if (!Array.isArray(body.elements)) throw new Error("Overpass returned no elements array");
  return body.elements;
}

const elements = await fetchElements();
// Sanity check: these two neighborhoods have well over a hundred mapped bars. A tiny result means a bad response.
const MIN_EXPECTED = Number(process.env.OSM_MIN_EXPECTED ?? 50);
if (fileIdx < 0 && parseOverpass(elements).length < MIN_EXPECTED) {
  throw new Error(`Only ${parseOverpass(elements).length} venues parsed (expected >= ${MIN_EXPECTED}); refusing to import a partial result`);
}
if (dryRun) {
  const venues = parseOverpass(elements);
  console.log(`[venues:import] dry run: ${elements.length} elements -> ${venues.length} named venues`);
  for (const v of venues.slice(0, 15)) console.log(`  ${v.osmId.padEnd(16)} ${v.kind.padEnd(10)} ${v.neighborhood.padEnd(16)} ${v.name} (${v.address})`);
  if (venues.length > 15) console.log(`  … ${venues.length - 15} more`);
} else {
  const db = new PrismaClient();
  try {
    // Real venues belong in production (and local experiments), not next to the fictional demo seed.
    const demo = await db.venue.count({ where: { id: { startsWith: "seed_v_" } } });
    if (demo > 0 && !args.includes("--allow-demo")) {
      throw new Error(`This database has ${demo} demo-seed venues. Import real venues into a database without the demo seed, or pass --allow-demo.`);
    }
    const r = await importOsmVenues(db, elements);
    console.log(`[venues:import] ${r.fetched} venues: ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged, ${r.skippedClaimed} claimed (name/address kept)`);
  } finally {
    await db.$disconnect();
  }
}
