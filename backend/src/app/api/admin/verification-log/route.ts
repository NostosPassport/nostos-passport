import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { verificationLog } from "@/server/services/verification";

export const dynamic = "force-dynamic";

/** Admin-only: every grant and revoke, newest first (`?handle=` for one account). */
export const GET = route(async (req) => ok({ events: await verificationLog(prisma, await getActor(req), new URL(req.url).searchParams.get("handle")) }));
