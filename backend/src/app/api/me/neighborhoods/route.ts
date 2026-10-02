import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { neighborhoodIndex } from "@/server/services/neighborhoods";

export const dynamic = "force-dynamic";

/** The passport's index: every neighborhood with places, and your progress. Owner only. */
export const GET = route(async (req) => ok(await neighborhoodIndex(prisma, await getActor(req))));
