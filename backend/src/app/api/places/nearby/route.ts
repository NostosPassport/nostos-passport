import { prisma } from "@/lib/db";
import { isValidLatLng } from "@/lib/geo";
import { badRequest } from "@/server/errors";
import { ok, route } from "@/server/http";
import { nearbyPlaces } from "@/server/services/places";

export const dynamic = "force-dynamic";

/** Places inside or near the geofence of `?lat=&lng=`, nearest first. The position is used for this response only and never stored. */
export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams;
  const pos = { lat: Number(q.get("lat")), lng: Number(q.get("lng")) };
  if (q.get("lat") === null || q.get("lng") === null || !isValidLatLng(pos)) throw badRequest("lat and lng are required");
  return ok({ places: await nearbyPlaces(prisma, pos) });
});
