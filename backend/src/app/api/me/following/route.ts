import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { listFollowing } from "@/server/services/people";

export const dynamic = "force-dynamic";

/** People you follow; `goingTonight` is filled in for mutual follows only. */
export const GET = socialRoute(async (req) => ok({ following: await listFollowing(prisma, await getActor(req)) }));
