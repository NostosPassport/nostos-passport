import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { getProfile } from "@/server/services/people";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

export const GET = route<Ctx>(async (req, { params }) => ok(await getProfile(prisma, (await params).handle, await getActor(req))));
