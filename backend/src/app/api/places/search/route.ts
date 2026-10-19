import { prisma } from "@/lib/db";
import { isValidLatLng } from "@/lib/geo";
import { getActor, ok, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { searchPlaces } from "@/server/services/places";

export const dynamic = "force-dynamic";

/** Google-backed restaurant/bar search. Results are not persisted until a place is opened or stamped. */
export const GET = route(async (req) => {
  requireSignedIn(await getActor(req));
  const q = new URL(req.url).searchParams;
  const lat = q.get("lat"), lng = q.get("lng");
  const candidate = lat !== null && lng !== null ? { lat: Number(lat), lng: Number(lng) } : null;
  const bias = candidate && isValidLatLng(candidate) ? candidate : null;
  return ok({ places: await searchPlaces(prisma, q.get("q"), bias), attribution: null });
});
