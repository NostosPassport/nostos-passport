import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { attributionFor, listVenuesForMap } from "@/server/services/venues";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const venues = await listVenuesForMap(prisma, await getActor(req));
  return ok({ venues, attribution: attributionFor(venues), at: new Date().toISOString() });
});
