import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/server/cron";
import { pruneLoginAttempts } from "@/server/services/auth";
import { pruneRateEvents } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled housekeeping (daily via vercel.json). Vercel Cron issues GET with `Authorization: Bearer $CRON_SECRET`;
 * POST is accepted too for manual runs. Prunes day-old login attempts and day-old rate-limit rows. Nothing else:
 * there are no jobs that rank, score or feature content.
 */
async function handler(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized", message: "Bad cron secret" }, { status: 401 });
  const started = Date.now();
  const [prunedLoginAttempts, prunedRateEvents] = await Promise.all([pruneLoginAttempts(prisma), pruneRateEvents(prisma)]);
  return NextResponse.json({ ok: true, prunedLoginAttempts, prunedRateEvents, ms: Date.now() - started });
}

export const GET = handler;
export const POST = handler;
