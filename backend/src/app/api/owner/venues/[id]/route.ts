import { prisma } from "@/lib/db";
import { getActor, ok, parseJson, route } from "@/server/http";
import { officialInfoSchema, ownerVenueDashboard, updateOfficialInfo } from "@/server/services/owner";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  const venue = await updateOfficialInfo(prisma, actor, (await params).id, await parseJson(req, officialInfoSchema));
  return ok({ venue: { id: venue.id, officialCoverCents: venue.officialCoverCents } });
});

export const dynamic = "force-dynamic";

/** Owner dashboard for one venue (owner of that venue only). */
export const GET = route<Ctx>(async (req, { params }) => ok(await ownerVenueDashboard(prisma, await getActor(req), (await params).id)));
