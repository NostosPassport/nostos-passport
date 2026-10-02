import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { blockUser, unblockUser } from "@/server/services/blocks";

type Ctx = { params: Promise<{ handle: string }> };

export const POST = socialRoute<Ctx>(async (req, { params }) => ok(await blockUser(prisma, await getActor(req), (await params).handle)));
export const DELETE = socialRoute<Ctx>(async (req, { params }) => ok(await unblockUser(prisma, await getActor(req), (await params).handle)));
