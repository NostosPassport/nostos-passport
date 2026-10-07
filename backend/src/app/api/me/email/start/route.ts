import { prisma } from "@/lib/db";
import { clientIp, getActor, ok, readJson, route } from "@/server/http";
import { startEmailChange } from "@/server/services/email";

export const POST = route(async (req) => ok(await startEmailChange(prisma, await getActor(req), await readJson(req), { ip: clientIp(req) })));
