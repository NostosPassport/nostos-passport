/**
* pnpm venues:import [--dry-run] [--file overpass.json] [--allow-demo] [--bbox S,W,N,E]
 * Pulls places from the OpenStreetMap Overpass API and upserts them idempotently on osm_id.
 */
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_BBOX, overpassQuery, parseOverpass, type OverpassElement } from "../src/lib/osm";
import { importOsmVenues } from "../src/server/services/osm-import";

if (existsSync(".env")) process.loadEnvFile(".env");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileIdx = args.indexOf("--file");
const bboxIdx = args.indexOf("--bbox");
const bbox = (bboxIdx >= 0 ? args[bboxIdx + 1]!.split(",").map(Number) : [...DEFAULT_BBOX]) as [number, number, number, number];
const endpoint = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

async function fetchElements(): Promise<OverpassElement[]> {
  if (fileIdx >= 0) return (JSON.parse(readFileSync(args[fileIdx + 1]!, "utf8")) as { elements: OverpassElement[] }).elements;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Nostos-venue-import/1.0 (support@nostospassport.com)" },
    body: new URLSearchParams({ data: overpassQuery(bbox) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  let body: { elements?: OverpassElement[]; remark?: string };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    throw new Error(`Overpass returned a non-JSON response: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  if (body.remark && /error|timed out|out of memory|runtime/i.test(body.remark)) throw new Error(`Overpass failed: ${body.remark}`);
  if (!Array.isArray(body.elements)) throw new Error("Overpass returned no elements array");
  return body.elements;
}

const elements = await fetchElements();
const db = new PrismaClient();
try {
  const parsed = parseOverpass(elements);
  const MIN_EXPECTED = Number(process.env.OSM_MIN_EXPECTED ?? 50);
  if (fileIdx < 0 && parsed.length < MIN_EXPECTED) throw new Error(`Only ${parsed.length} places parsed (expected >= ${MIN_EXPECTED}); refusing to import a partial result`);
  if (dryRun) {
    console.log(`[venues:import] dry run: ${elements.length} elements -> ${parsed.length} named places`);
    for (const v of parsed.slice(0, 15)) console.log(`  ${v.osmId.padEnd(16)} ${v.kind.padEnd(12)} ${(v.area ?? "").padEnd(24)} ${v.name} (${v.address})`);
    if (parsed.length > 15) console.log(`  ... ${parsed.length - 15} more`);
  } else {
    const demo = await db.venue.count({ where: { id: { startsWith: "seed_v_" } } });
    if (demo > 0 && !args.includes("--allow-demo")) {
      throw new Error(`This database has ${demo} demo-seed places. Import real places into a database without the demo seed, or pass --allow-demo.`);
    }
    const r = await importOsmVenues(db, elements);
    console.log(`[venues:import] ${r.fetched} places: ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged`);
  }
} finally {
  await db.$disconnect();
}
