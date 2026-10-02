import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, destroyAllSessions } from "@/lib/auth/session";
import { requireActor, route } from "@/server/http";

/** Signs out everywhere: revokes every web and iOS session for the current user. */
export const POST = route(async (req) => {
  const actor = await requireActor(req);
  const revoked = await destroyAllSessions(prisma, actor.userId);
  const res = NextResponse.json({ ok: true, revoked });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
