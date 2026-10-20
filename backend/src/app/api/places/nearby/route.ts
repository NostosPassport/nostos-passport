import { prisma } from "@/lib/db";
import { isValidLatLng } from "@/lib/geo";
import { badRequest } from "@/server/errors";
import { getActor, ok, route } from "@/server/http";
import { requireSignedIn } from "@/server/permissions";
import { nearbyPlaces } from "@/server/services/places";

export const dynamic = "force-dynamic";

/** Nearby Google restaurants/bars. The position is used for this response only and never stored. */
export const GET = route(async (req) => {
  requireSignedIn(await getActor(req));
  const q = new URL(req.url).searchParams;
  const pos = { lat: Number(q.get("lat")), lng: Number(q.get("lng")) };
  if (q.get("lat") === null || q.get("lng") === null || !isValidLatLng(pos)) throw badRequest("lat and lng are required");
  const radius = q.get("radius") === null ? 750 : Number(q.get("radius"));
  if (!Number.isFinite(radius) || radius < 100 || radius > 5_000) throw badRequest("radius must be between 100 and 5000 meters");
  return ok({ places: await nearbyPlaces(prisma, pos, radius) });
});
