import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { moderationQueue } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ok({ items: await moderationQueue(prisma, await getActor(req)) }));
