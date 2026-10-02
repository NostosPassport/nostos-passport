import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { removePost } from "@/server/services/posts";

type Ctx = { params: Promise<{ id: string }> };

/** "Delete from profile": hides the post everywhere, for good. User content is never deleted, so this is a POST. */
export const POST = route<Ctx>(async (req, { params }) => ok(await removePost(prisma, await getActor(req), (await params).id)));
