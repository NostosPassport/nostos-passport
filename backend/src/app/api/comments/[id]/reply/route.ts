import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { commentBodySchema, replyAsVenue } from "@/server/services/comments";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  const reply = await replyAsVenue(prisma, actor, (await params).id, await parseJson(req, commentBodySchema));
  return ok({ reply: { id: reply.id } }, 201);
});
