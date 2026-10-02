import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { blockAuthorOf } from "@/server/services/blocks";

/**
 * Block the author of a photo or comment by content id: `{targetType: "PHOTO"|"COMMENT", targetId}`. Works when the
 * author reads "Anonymous" to you; the response never says who it was.
 */
export const POST = route(async (req) => ok(await blockAuthorOf(prisma, await getActor(req), await readJson(req))));
