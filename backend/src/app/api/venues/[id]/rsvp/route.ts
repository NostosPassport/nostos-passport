import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { setGoingTonight } from "@/server/services/social";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => ok(await setGoingTonight(prisma, await getActor(req), (await params).id, true)));
export const DELETE = route<Ctx>(async (req, { params }) => ok(await setGoingTonight(prisma, await getActor(req), (await params).id, false)));
