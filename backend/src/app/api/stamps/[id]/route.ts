import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { editStamp, getStamp } from "@/server/services/stamps";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Stamp detail (404 when the viewer may not see it). */
export const GET = route<Ctx>(async (req, { params }) => ok(await getStamp(prisma, await getActor(req), (await params).id)));

/** Author edits: caption and song (`song: null` removes it). Send only changed fields. */
export const PATCH = route<Ctx>(async (req, { params }) => ok(await editStamp(prisma, await getActor(req), (await params).id, await readJson(req))));
