import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/server/cron";
import { recomputeAllReputations } from "@/server/services/reputation";
import { pruneLoginAttempts } from "@/server/services/auth";
import { pruneExpiredPresence } from "@/server/services/social";
import { pruneRateEvents } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled reputation recompute (every 10 minutes via vercel.json). Vercel Cron issues GET with
 * `Authorization: Bearer $CRON_SECRET`; POST is accepted too for manual runs. Also prunes day-old login
 * attempts, expired "here now" rows and day-old rate-limit rows.
 */
async function handler(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized", message: "Bad cron secret" }, { status: 401 });
  const started = Date.now();
  const [rep, pruned, prunedPresence] = await Promise.all([recomputeAllReputations(prisma), pruneLoginAttempts(prisma), pruneExpiredPresence(prisma), pruneRateEvents(prisma)]);
  // `skipped: true` means another run held the lock and this one wrote nothing.
  return NextResponse.json({ ok: true, ...rep, prunedLoginAttempts: pruned, prunedPresence, ms: Date.now() - started });
}

export const GET = handler;
export const POST = handler;
