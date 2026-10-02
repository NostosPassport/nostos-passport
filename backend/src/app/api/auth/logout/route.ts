import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, destroySession } from "@/lib/auth/session";
import { credentials, getActor, route } from "@/server/http";

/**
 * Revokes the session this request is authenticated with. A bearer token that doesn't resolve gets 401
 * (via getActor), so the app knows nothing was revoked. Cookie logout is idempotent for the web.
 */
export const POST = route(async (req) => {
  const cred = credentials(req);
  if (cred.kind === "bearer") await getActor(req);
  await destroySession(prisma, cred.token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
