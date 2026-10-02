import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { presenceSchema, recordPresence } from "@/server/services/social";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await getActor(req);
  return ok(await recordPresence(prisma, actor, id, await parseJson(req, presenceSchema)));
});
