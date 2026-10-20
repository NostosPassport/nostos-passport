import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { setStampCollections } from "@/server/services/collections";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const PUT = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await setStampCollections(prisma, await getActor(req), id, await readJson(req)));
});
