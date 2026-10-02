import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { listConnections } from "@/server/services/people";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

/** People this account follows. Needs full access to the profile (403 `private_account` otherwise). */
export const GET = route<Ctx>(async (req, { params }) => ok({ people: await listConnections(prisma, await getActor(req), (await params).handle, "following") }));
