import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { setStampInPassport } from "@/server/services/books";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

/** `{ inPassport: false }` takes a stamp out of the main passport without removing it; `true` puts it back. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  return ok(await setStampInPassport(prisma, await getActor(req), id, await readJson(req)));
});
