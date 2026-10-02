import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { listBlocks } from "@/server/services/blocks";

export const dynamic = "force-dynamic";

export const GET = socialRoute(async (req) => ok({ blocks: await listBlocks(prisma, await getActor(req)) }));
