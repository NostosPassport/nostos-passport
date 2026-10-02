import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { likePost, unlikePost } from "@/server/services/likes";

type Ctx = { params: Promise<{ id: string }> };

/** Like a shared post you can see (once; not your own). */
export const PUT = route<Ctx>(async (req, { params }) => ok(await likePost(prisma, await getActor(req), (await params).id)));
/** Unlike. */
export const DELETE = route<Ctx>(async (req, { params }) => ok(await unlikePost(prisma, await getActor(req), (await params).id)));
