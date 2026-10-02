import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getActor, readJson, route } from "@/server/http";
import { deleteAccount } from "@/server/services/account";

/** Deletes (anonymizes) the signed-in account after re-checking the password. Signs out everywhere. */
export const POST = route(async (req) => {
  const result = await deleteAccount(prisma, await getActor(req), await readJson(req));
  const res = NextResponse.json(result);
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
