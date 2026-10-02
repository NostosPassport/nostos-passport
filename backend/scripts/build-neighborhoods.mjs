// Builds prisma/data/neighborhoods.json from NYC's public Neighborhood Tabulation Areas (2020), NYC Open Data dataset 9nt8-h7nd
// (https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson). Public domain city data. Keeps residential areas (ntatype 0) and
// parks and open space (ntatype 9), the outer ring of each polygon only, simplified (Douglas-Peucker, about 6 m) and rounded to
// 5 decimals so the file stays small. Usage: node scripts/build-neighborhoods.mjs [path-to-downloaded.geojson]
import { readFileSync, writeFileSync } from "node:fs";

const URL_ = "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=500";
const src = process.argv[2] ? readFileSync(process.argv[2], "utf8") : await (await fetch(URL_)).text();
const data = JSON.parse(src);
const TOL = 0.00006;

/** Simplify a closed ring: split it at the point farthest from the start (a closed ring has no usable baseline), simplify both halves. */
function simplifyRing(ring, tol) {
  let far = 1, best = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) { best = d; far = i; }
  }
  const a = dp(ring.slice(0, far + 1), tol);
  const b = dp(ring.slice(far), tol);
  return [...a.slice(0, -1), ...b];
}

function dp(points, tol) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
  let max = 0, idx = 0;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [points[0], points[points.length - 1]];
  return [...dp(points.slice(0, idx + 1), tol).slice(0, -1), ...dp(points.slice(idx), tol)];
}
const r5 = (n) => Math.round(n * 1e5) / 1e5;

const out = [];
for (const f of data.features) {
  const p = f.properties;
  if (!["0", "9"].includes(p.ntatype)) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys
    .map((poly) => simplifyRing(poly[0], TOL).map(([lng, lat]) => [r5(lng), r5(lat)]))
    .filter((ring) => ring.length >= 4)
    .sort((a, b) => b.length - a.length);
  if (!rings.length) continue;
  const name = p.ntaname;
  out.push({ code: p.nta2020, name, borough: p.boroname, rings });
}
out.sort((a, b) => (a.code < b.code ? -1 : 1));
writeFileSync(new URL("../prisma/data/neighborhoods.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} neighborhoods, ${(JSON.stringify(out).length / 1024).toFixed(0)} KiB`);
