import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { getPlace } from "@/server/services/places";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await getActor(req);
  return ok({ place: await getPlace(prisma, (await params).id) });
});
