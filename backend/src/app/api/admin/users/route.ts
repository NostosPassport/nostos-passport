import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { adminSearchUsers } from "@/server/services/verification";

export const dynamic = "force-dynamic";

/** Admin-only user search (verification tools). */
export const GET = route(async (req) => ok({ users: await adminSearchUsers(prisma, await getActor(req), (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80)) }));
