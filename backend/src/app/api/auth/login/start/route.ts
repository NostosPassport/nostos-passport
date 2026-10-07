import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { clientIp, readJson, route } from "@/server/http";
import { startLogin } from "@/server/services/auth";

export const POST = route(async (req) => {
  const challenge = await startLogin(prisma, await readJson(req), { ip: clientIp(req) });
  return NextResponse.json(challenge);
});
