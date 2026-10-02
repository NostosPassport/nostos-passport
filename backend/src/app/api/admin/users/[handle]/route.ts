import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { setUserFlags } from "@/server/services/admin";

type Ctx = { params: Promise<{ handle: string }> };

/** Admin-only account flags (currently: geofenceExempt for App Review / QA accounts). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await getActor(req);
  return ok({ user: await setUserFlags(prisma, actor, (await params).handle, await readJson(req)) });
});
