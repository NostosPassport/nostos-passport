// Next.js boot hook. In development only, runs the reputation job in-process every 10 minutes.
// Everywhere else (Vercel preview/production) Vercel Cron calls /api/cron/reputation instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  if (process.env.NODE_ENV !== "development") return;
  const { startScheduler } = await import("@/server/scheduler");
  startScheduler();
}
