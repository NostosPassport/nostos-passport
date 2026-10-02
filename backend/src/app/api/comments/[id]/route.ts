import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { commentBodySchema, editComment } from "@/server/services/comments";

type Ctx = { params: Promise<{ id: string }> };

/** Author-only edit. There is intentionally no DELETE handler: user content is hidden by moderators, never deleted. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const comment = await editComment(prisma, await getActor(req), id, await parseJson(req, commentBodySchema));
  return ok({ comment: { id: comment.id, body: comment.body, editedAt: comment.editedAt } });
});
