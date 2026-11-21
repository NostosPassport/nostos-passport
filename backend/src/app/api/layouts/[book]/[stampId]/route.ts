import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { setStampPlacement } from "@/server/services/books";

type Ctx = { params: Promise<{ book: string; stampId: string }> };
export const dynamic = "force-dynamic";

export const PUT = route<Ctx>(async (req, { params }) => {
  const { book, stampId } = await params;
  return ok(await setStampPlacement(prisma, await getActor(req), book, stampId, await readJson(req)));
});
