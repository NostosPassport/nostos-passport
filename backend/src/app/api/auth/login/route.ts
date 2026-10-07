import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieAttributes } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readJson, route } from "@/server/http";
import { login } from "@/server/services/auth";
import { isIosClient, publicUser } from "../client";

export const POST = route(async (req) => {
  const ios = isIosClient(req);
  const { user, session } = await login(prisma, await readJson(req), { client: ios ? "IOS" : "WEB" });
  if (ios) return NextResponse.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) });
  const res = NextResponse.json({ user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieAttributes(session.expiresAt));
  return res;
});
