import { prisma } from "@/lib/db";
import { getActor, ok, selfOrSocialRoute } from "@/server/http";
import { listUserStamps } from "@/server/services/stamps";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

/** The passport's stamps grid, newest first, 30 per page (`?before=` the previous page's `nextBefore`). 403 `private_account`. */
export const GET = selfOrSocialRoute<Ctx>(async (req, { params }) =>
  ok(await listUserStamps(prisma, await getActor(req), (await params).handle, new URL(req.url).searchParams.get("before"))),
);
