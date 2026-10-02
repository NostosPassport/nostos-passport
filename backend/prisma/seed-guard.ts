/**
 * The demo seed (and `db:reset`, which drops the database first) wipes every table and inserts fictional
 * venues and people. It must never run against production. It is allowed only when:
 *   - APP_ENV is "development" or "preview" (explicitly), and VERCEL_ENV is not "production"; or
 *   - APP_ENV is unset AND the database host is local (localhost / 127.0.0.1 / docker "db").
 * A missing APP_ENV against a remote database is refused, so a forgotten variable fails safe.
 */
export function assertSeedAllowed(env: Record<string, string | undefined>) {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  const refuse = (why: string) => {
    throw new Error(`Refusing to run the demo seed: ${why}. It wipes all tables and inserts fake data. Use \`pnpm venues:import\` for real venues.`);
  };
  if (appEnv === "production") refuse("APP_ENV=production");
  if (env.VERCEL_ENV === "production") refuse("VERCEL_ENV=production");
  if (appEnv === "preview") {
    // Preview is a public URL: seeded accounts (incl. admin/moderator) must not use the well-known dev password.
    const pw = env.DEV_SEED_PASSWORD ?? "";
    if (pw.length < 16 || pw === "lastcall-dev") refuse("APP_ENV=preview needs a strong DEV_SEED_PASSWORD (16+ chars, not the dev default)");
    if (!env.APP_REVIEW_PASSWORD || env.APP_REVIEW_PASSWORD.length < 12) refuse("APP_ENV=preview needs APP_REVIEW_PASSWORD (12+ chars) for the App Review account");
    return;
  }
  if (appEnv === "development") return;
  if (appEnv) refuse(`unknown APP_ENV "${appEnv}"`);
  let host = "";
  try {
    host = new URL(env.DIRECT_URL ?? env.DATABASE_URL ?? "").hostname;
  } catch {
    refuse("DATABASE_URL is missing or invalid");
  }
  if (!["localhost", "127.0.0.1", "::1", "db"].includes(host)) refuse(`APP_ENV is not set and the database (${host}) is not local`);
}
