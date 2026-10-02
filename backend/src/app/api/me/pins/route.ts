import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { listPins, setPins } from "@/server/services/pins";

export const dynamic = "force-dynamic";

/** Your pinned stamps (up to 4), in order. Owner only. */
export const GET = route(async (req) => ok(await listPins(prisma, await getActor(req))));
/** Replace your pins: `{ stampIds: [...] }`, up to 4 of your own stamps. */
export const PUT = route(async (req) => ok(await setPins(prisma, await getActor(req), await readJson(req))));
