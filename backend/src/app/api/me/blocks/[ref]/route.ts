import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { unblockByRef } from "@/server/services/blocks";

type Ctx = { params: Promise<{ ref: string }> };

/** Unblock from the block list by the block's `ref` (works for blocks made from Anonymous content). */
export const DELETE = route<Ctx>(async (req, { params }) => ok(await unblockByRef(prisma, await getActor(req), (await params).ref)));
