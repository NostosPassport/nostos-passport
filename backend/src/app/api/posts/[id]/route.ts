import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { editPost, getPost } from "@/server/services/posts";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Post detail (404 when the viewer may not see it). */
export const GET = route<Ctx>(async (req, { params }) => ok(await getPost(prisma, await getActor(req), (await params).id)));

/** Author edits: rating (until the night ends), caption, shared. Send only changed fields. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const photo = await editPost(prisma, await getActor(req), (await params).id, await readJson(req));
  return ok({ post: { id: photo.id, rating: photo.rating, caption: photo.caption, shared: photo.shared, editedAt: photo.editedAt } });
});
