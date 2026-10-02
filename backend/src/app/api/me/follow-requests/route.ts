import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { listFollowRequests } from "@/server/services/people";

export const dynamic = "force-dynamic";

/** Pending requests to follow the signed-in (private) account, newest first. */
export const GET = socialRoute(async (req) => ok({ requests: await listFollowRequests(prisma, await getActor(req)) }));
