import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { claimSchema, requestClaim } from "@/server/services/owner";

export const POST = route(async (req) => {
  const actor = await getActor(req);
  const claim = await requestClaim(prisma, actor, await parseJson(req, claimSchema));
  return ok({ claim: { id: claim.id, status: claim.status } }, 201);
});
