import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { decideFollowRequest } from "@/server/services/people";

type Ctx = { params: Promise<{ handle: string }> };

/** Approve or decline the request from :handle. Only requests addressed to you exist here (404 otherwise). */
export const POST = route<Ctx>(async (req, { params }) => ok(await decideFollowRequest(prisma, await getActor(req), (await params).handle, await readJson(req))));
