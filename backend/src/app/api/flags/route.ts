import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, socialRoute } from "@/server/http";
import { flagContent, flagSchema } from "@/server/services/moderation";

export const POST = socialRoute(async (req) => {
  const actor = await getActor(req);
  const { flag, autoHidden } = await flagContent(prisma, actor, await parseJson(req, flagSchema));
  return ok({ flag: { id: flag.id }, autoHidden }, 201);
});
