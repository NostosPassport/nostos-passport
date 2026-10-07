import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getActor, readJson, route } from "@/server/http";
import { deleteAccount } from "@/server/services/account";

/** Deletes (anonymizes) the signed-in account after a fresh email-code confirmation. Signs out everywhere. */
export const POST = route(async (req) => {
  const result = await deleteAccount(prisma, await getActor(req), await readJson(req));
  const res = NextResponse.json(result);
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
