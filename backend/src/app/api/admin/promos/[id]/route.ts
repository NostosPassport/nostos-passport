import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { promoPaidSchema, setPromoPaid } from "@/server/services/admin";
import { promoView } from "@/server/services/owner";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  return ok({ promo: promoView(await setPromoPaid(prisma, actor, (await params).id, await parseJson(req, promoPaidSchema))) });
});
