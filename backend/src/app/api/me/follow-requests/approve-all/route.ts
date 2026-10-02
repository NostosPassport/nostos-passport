import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { approveAllFollowRequests } from "@/server/services/people";

/** Approve every pending request (offered after switching to a public account). */
export const POST = route(async (req) => ok(await approveAllFollowRequests(prisma, await getActor(req))));
