import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { likeStamp, unlikeStamp } from "@/server/services/likes";

type Ctx = { params: Promise<{ id: string }> };

/** Like a stamp you can see (once; not your own). */
export const PUT = socialRoute<Ctx>(async (req, { params }) => ok(await likeStamp(prisma, await getActor(req), (await params).id)));
/** Unlike. */
export const DELETE = socialRoute<Ctx>(async (req, { params }) => ok(await unlikeStamp(prisma, await getActor(req), (await params).id)));
