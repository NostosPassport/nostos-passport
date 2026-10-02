import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { listUserPosts } from "@/server/services/posts";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

/** Posts grid, newest first, 30 per page (`?before=` the previous page's `nextBefore`). 403 `private_account`. */
export const GET = route<Ctx>(async (req, { params }) =>
  ok(await listUserPosts(prisma, await getActor(req), (await params).handle, new URL(req.url).searchParams.get("before"))),
);
