import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { recentModerationLog } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const events = await recentModerationLog(prisma, await getActor(req), 50);
  return ok({
    events: events.map((e) => ({ id: e.id, action: e.action, targetType: e.targetType, targetId: e.targetId, by: e.actor?.handle ?? "system", note: e.note, createdAt: e.createdAt })),
  });
});
