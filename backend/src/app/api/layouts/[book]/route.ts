import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { getBookLayout } from "@/server/services/books";

type Ctx = { params: Promise<{ book: string }> };
export const dynamic = "force-dynamic";

/** Every stamp the owner has placed by hand in one book: `passport` or a collection id. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { book } = await params;
  return ok(await getBookLayout(prisma, await getActor(req), book));
});
