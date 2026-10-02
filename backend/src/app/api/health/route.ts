import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB check for uptime monitors and post-deploy smoke tests. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up", env: process.env.APP_ENV ?? "development", commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, ms: Date.now() - started },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
