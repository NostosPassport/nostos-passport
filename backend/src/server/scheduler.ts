import { prisma } from "@/lib/db";
import { recomputeAllReputations } from "@/server/services/reputation";

const EVERY_MS = 10 * 60_000;
const g = globalThis as unknown as { __nostosScheduler?: NodeJS.Timeout };

/** In-process scheduler (single-node). A multi-instance deploy would use cron; the advisory lock already prevents overlap. */
export function startScheduler() {
  if (g.__nostosScheduler) return;
  const tick = () =>
    recomputeAllReputations(prisma)
      .then((r) => console.log(`[job] reputation: judged ${r.judged}, updated ${r.updated}`))
      .catch((e) => console.error("[job] reputation failed", e));
  setTimeout(tick, 15_000);
  g.__nostosScheduler = setInterval(tick, EVERY_MS);
}
