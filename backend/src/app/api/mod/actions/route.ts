import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { moderate, moderateSchema } from "@/server/services/moderation";

export const POST = route(async (req) => {
  const actor = await getActor(req);
  const target = await moderate(prisma, actor, await parseJson(req, moderateSchema));
  return ok({ target: target && { id: target.id, hidden: Boolean(target.hiddenAt) } });
});
