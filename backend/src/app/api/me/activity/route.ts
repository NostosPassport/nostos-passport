import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { listActivity } from "@/server/services/activity";

export const dynamic = "force-dynamic";

/** Follow requests, new followers, likes on your posts and your features, newest first (last 30 days). */
export const GET = route(async (req) => ok({ items: await listActivity(prisma, await getActor(req)) }));
