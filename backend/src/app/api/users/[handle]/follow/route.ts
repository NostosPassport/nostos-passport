import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { follow, unfollow } from "@/server/services/people";

type Ctx = { params: Promise<{ handle: string }> };

export const PUT = route<Ctx>(async (req, { params }) => ok(await follow(prisma, await getActor(req), (await params).handle)));
export const DELETE = route<Ctx>(async (req, { params }) => ok(await unfollow(prisma, await getActor(req), (await params).handle)));
