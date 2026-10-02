import { prisma } from "@/lib/db";
import { getActor, ok, readJson, route } from "@/server/http";
import { getProfileSettings, updateProfile } from "@/server/services/people";

export const dynamic = "force-dynamic";

/** Your editable profile: display name, bio, private toggle, profile photo. */
export const GET = route(async (req) => ok(await getProfileSettings(prisma, await getActor(req))));
/** Send only changed fields. Switching to public leaves pending requests pending (see approve-all). */
export const PATCH = route(async (req) => ok(await updateProfile(prisma, await getActor(req), await readJson(req))));
