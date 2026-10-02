import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { attributionFor, listPlaces } from "@/server/services/places";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  // Public data, but a dead bearer token still gets a 401 so the app learns it must sign in again.
  await getActor(req);
  const places = await listPlaces(prisma);
  return ok({ places, attribution: attributionFor(places) });
});
