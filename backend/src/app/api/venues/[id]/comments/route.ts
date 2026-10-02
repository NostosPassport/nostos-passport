import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { addComment, commentBodySchema } from "@/server/services/comments";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const comment = await addComment(prisma, await getActor(req), id, await parseJson(req, commentBodySchema));
  return ok({ comment: { id: comment.id } }, 201);
});
