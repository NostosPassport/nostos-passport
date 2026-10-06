import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { changeEmail } from "@/server/services/email";

export const PATCH = route(async (req) => ok(await changeEmail(prisma, await getActor(req), await readJson(req))));
