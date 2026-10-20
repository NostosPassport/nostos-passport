import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { disableCollectionShare, enableCollectionShare, getCollectionShareStatus } from "@/server/services/collection-sharing";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await getCollectionShareStatus(prisma, await getActor(req), id));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await enableCollectionShare(prisma, await getActor(req), id));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await disableCollectionShare(prisma, await getActor(req), id));
});
