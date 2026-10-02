import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { reviewClaim, reviewClaimSchema } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  const claim = await reviewClaim(prisma, actor, (await params).id, await parseJson(req, reviewClaimSchema));
  return ok({ claim: { id: claim.id, status: claim.status } });
});
