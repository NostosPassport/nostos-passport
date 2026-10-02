import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { removeStamp } from "@/server/services/stamps";

type Ctx = { params: Promise<{ id: string }> };

/** "Delete from profile": hides the stamp everywhere, for good. User content is never deleted, so this is a POST. */
export const POST = route<Ctx>(async (req, { params }) => ok(await removeStamp(prisma, await getActor(req), (await params).id)));
