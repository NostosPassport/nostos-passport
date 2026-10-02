import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { createPromo, promoView } from "@/server/services/owner";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  const promo = await createPromo(prisma, actor, (await params).id, await readJson(req));
  return ok({ promo: promoView(promo) }, 201);
});
