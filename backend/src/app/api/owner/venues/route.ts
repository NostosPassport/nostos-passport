import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { ownerOverview } from "@/server/services/owner";

export const dynamic = "force-dynamic";

/** Venues the caller manages, plus their pending/rejected claims. */
export const GET = route(async (req) => {
  const { venues, claims } = await ownerOverview(prisma, await getActor(req));
  return ok({ venues, claims: claims.map((c) => ({ id: c.id, venueName: c.venue.name, status: c.status, createdAt: c.createdAt })) });
});
