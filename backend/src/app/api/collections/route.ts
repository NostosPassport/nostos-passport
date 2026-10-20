import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { createCollection, listCollections } from "@/server/services/collections";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ok(await listCollections(prisma, await getActor(req))));
export const POST = route(async (req) => ok(await createCollection(prisma, await getActor(req), await readJson(req)), 201));
