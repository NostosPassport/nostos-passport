import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { listUserStamps } from "@/server/services/stamps";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

export const GET = route<Ctx>(async (req, { params }) =>
  ok(await listUserStamps(prisma, await getActor(req), (await params).handle, new URL(req.url).searchParams.get("after"))),
);
