import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { removeFollower } from "@/server/services/people";

type Ctx = { params: Promise<{ handle: string }> };

/** Remove :handle from your followers. They aren't told; they can request again (or follow, if you're public). */
export const DELETE = socialRoute<Ctx>(async (req, { params }) => ok(await removeFollower(prisma, await getActor(req), (await params).handle)));
