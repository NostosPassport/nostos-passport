import { prisma } from "@/lib/db";
import { clientIp, getActor, ok, route } from "@/server/http";
import { startDeleteAccount } from "@/server/services/account";

export const POST = route(async (req) => ok(await startDeleteAccount(prisma, await getActor(req), { ip: clientIp(req) })));
