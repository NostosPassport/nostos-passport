import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { listFeed } from "@/server/services/stamps";

export const dynamic = "force-dynamic";

/** Home feed: stamps from people you follow, newest first, 30 per page. No ranking, no personalization. */
export const GET = socialRoute(async (req) => ok(await listFeed(prisma, await getActor(req), new URL(req.url).searchParams.get("before"))));
