import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { getStampMembership } from "@/server/services/books";
import { setStampCollections } from "@/server/services/collections";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const PUT = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await setStampCollections(prisma, await getActor(req), id, await readJson(req)));
});

/** Which books hold this stamp: the main passport and its collections. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await getStampMembership(prisma, await getActor(req), id));
});
