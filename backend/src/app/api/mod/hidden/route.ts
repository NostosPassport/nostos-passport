import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { recentlyHidden } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

/** Hidden content and suspended accounts, for RESTORE / UNSUSPEND. Moderators only. */
export const GET = route(async (req) => ok({ items: await recentlyHidden(prisma, await getActor(req)) }));
