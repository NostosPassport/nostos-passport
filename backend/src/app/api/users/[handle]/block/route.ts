import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { blockUser, unblockUser } from "@/server/services/blocks";

type Ctx = { params: Promise<{ handle: string }> };

export const POST = route<Ctx>(async (req, { params }) => ok(await blockUser(prisma, await getActor(req), (await params).handle)));
export const DELETE = route<Ctx>(async (req, { params }) => ok(await unblockUser(prisma, await getActor(req), (await params).handle)));
