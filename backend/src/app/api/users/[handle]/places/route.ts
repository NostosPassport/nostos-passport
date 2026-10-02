import { prisma } from "@/lib/db";
import { getActor, ok, route } from "@/server/http";
import { listUserPlaces } from "@/server/services/posts";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ handle: string }> };

/** Every venue this person has posted at, with their latest rating there (the Places tab). 403 `private_account`. */
export const GET = route<Ctx>(async (req, { params }) => ok(await listUserPlaces(prisma, await getActor(req), (await params).handle)));
