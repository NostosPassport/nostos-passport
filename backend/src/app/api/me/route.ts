import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { getMe } from "@/server/services/me";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ok(await getMe(prisma, await getActor(req))));
