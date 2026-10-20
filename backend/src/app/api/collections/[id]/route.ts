import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { deleteCollection, getCollection, updateCollection } from "@/server/services/collections";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await getCollection(prisma, await getActor(req), id));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await updateCollection(prisma, await getActor(req), id, await readJson(req)));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await deleteCollection(prisma, await getActor(req), id));
});
