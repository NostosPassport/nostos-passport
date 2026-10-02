import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { acceptCurrentTerms } from "@/server/services/me";

export const POST = route(async (req) => ok(await acceptCurrentTerms(prisma, await getActor(req), await readJson(req))));
