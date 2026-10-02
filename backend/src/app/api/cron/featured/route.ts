import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/server/cron";
import { runFeaturing } from "@/server/services/featuring";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Nightly featuring (cron-job.org at 5:05am America/New_York, see DEPLOY.md). `Authorization: Bearer $CRON_SECRET`.
 * Processes every completed night of the last 7 that hasn't been processed: safe to run late, or twice.
 */
async function handler(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized", message: "Bad cron secret" }, { status: 401 });
  const started = Date.now();
  const result = await runFeaturing(prisma);
  return NextResponse.json({ ok: true, ...result, ms: Date.now() - started });
}

// POST only: it writes, and cron-job.org sends POST (a GET could be replayed by a prefetch or a log).
export const POST = handler;
