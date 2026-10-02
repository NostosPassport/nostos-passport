import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { setVerified } from "@/server/services/verification";

type Ctx = { params: Promise<{ handle: string }> };

/** Admin-only: grant or revoke the verified badge, with a required note (logged, append-only). */
export const POST = route<Ctx>(async (req, { params }) => ok({ user: await setVerified(prisma, await getActor(req), (await params).handle, await readJson(req)) }));
