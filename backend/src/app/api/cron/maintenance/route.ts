import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/server/cron";
import { pruneLoginAttempts } from "@/server/services/auth";
import { pruneEmailChallenges } from "@/server/services/email-code";
import { pruneRateEvents } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized", message: "Bad cron secret" }, { status: 401 });
  const started = Date.now();
  const [prunedLoginAttempts, prunedRateEvents] = await Promise.all([
    pruneLoginAttempts(prisma),
    pruneRateEvents(prisma),
    pruneEmailChallenges(prisma),
  ]);
  return NextResponse.json({ ok: true, prunedLoginAttempts, prunedRateEvents, ms: Date.now() - started });
}

export const GET = handler;
export const POST = handler;
