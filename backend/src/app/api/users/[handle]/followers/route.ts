import { prisma } from "@/lib/db";
import { getActor, ok, socialRoute } from "@/server/http";
import { listConnections } from "@/server/services/people";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

/** People who follow this account. Needs full access to the profile (403 `private_account` otherwise). */
export const GET = socialRoute<Ctx>(async (req, { params }) => ok({ people: await listConnections(prisma, await getActor(req), (await params).handle, "followers") }));
