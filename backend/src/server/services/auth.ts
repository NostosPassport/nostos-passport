import { Prisma, type SessionClient } from "@prisma/client";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { hashPassword, verifyPassword, getDummyHash } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { MINUTE_MS } from "@/lib/time";
import { isOldEnough, MIN_AGE, parseBirthdate } from "@/lib/age";
import { assertCleanText, conflict, ServiceError, tooMany } from "@/server/errors";

/** Bump when the Terms or Privacy Policy change materially; users who accepted an older version can be re-prompted. */
export const CURRENT_TERMS_VERSION = "2026-09-24";

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(10, "Password must be at least 10 characters").max(200),
    displayName: z.string().trim().min(1).max(60),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,24}$/, "Handle: 3-24 letters, numbers, underscore"),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "You need to accept the Terms and Privacy Policy" }) }),
    /** YYYY-MM-DD. Read once for the 21+ check and never stored. */
    birthdate: z.string().refine((v) => parseBirthdate(v) !== null, "Enter your birthdate as YYYY-MM-DD"),
  })
  .strict();

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().max(200) }).strict();

export const UNDERAGE_MESSAGE = `You need to be ${MIN_AGE} or older to use Nostos`;

export async function signup(db: Db, input: unknown, opts: { client?: SessionClient; now?: Date } = {}) {
  const { birthdate, ...data } = signupSchema.parse(input);
  // The age gate comes before anything else touches the database. A refused attempt stores nothing about the person:
  // no account, no email, no birthdate, no log row. The birthdate goes out of scope here and is never written anywhere.
  if (!isOldEnough(birthdate, opts.now)) throw new ServiceError(403, "underage", UNDERAGE_MESSAGE);
  assertCleanText({ handle: data.handle, "display name": data.displayName });
  const existing = await db.user.findFirst({ where: { OR: [{ email: data.email }, { handle: data.handle }] } });
  if (existing) throw conflict(existing.email === data.email ? "Email already registered" : "Handle taken");
  // Public signup always creates a plain USER. Staff roles come from the command line or the seed.
  const passwordHash = await hashPassword(data.password);
  const user = await db.user
    .create({
      data: {
        email: data.email, handle: data.handle, displayName: data.displayName, passwordHash, role: "USER",
        termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION,
      },
    })
    .catch((err: unknown) => {
      // Lost a race with a concurrent signup for the same email/handle.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict("Email or handle already taken");
      throw err;
    });
  const session = await createSession(db, user.id, { client: opts.client });
  return { user, session };
}

// Login throttle, stored in Postgres so it works across serverless instances: at most 10 failed attempts per
// (email, client IP) per 15 minutes. Keying on the IP too means a stranger can't lock someone out from
// elsewhere (their failures only throttle their own IP). A per-IP ceiling across all emails (50 / 15 min)
// bounds how fast one client can grow the table or spray many accounts. The check, password verification
// and failure insert run under a transaction-scoped advisory lock on (email, IP), so parallel requests can't
// all slip under the limit. Old rows are pruned by the cron job.
export const LOGIN_FAIL_WINDOW_MS = 15 * MINUTE_MS;
export const LOGIN_MAX_FAILS = 10;
export const LOGIN_MAX_FAILS_PER_IP = 50;

export async function login(
  db: Db,
  input: z.infer<typeof loginSchema>,
  meta: { ip: string; client?: SessionClient } = { ip: "unknown" },
  now = new Date(),
) {
  const { email, password } = loginSchema.parse(input);
  const ip = meta.ip.slice(0, 64) || "unknown";
  const since = new Date(now.getTime() - LOGIN_FAIL_WINDOW_MS);
  const user = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`login:${email}:${ip}`}))`;
      const [pair, perIp] = await Promise.all([
        tx.loginAttempt.count({ where: { email, ip, createdAt: { gt: since } } }),
        tx.loginAttempt.count({ where: { ip, createdAt: { gt: since } } }),
      ]);
      if (pair >= LOGIN_MAX_FAILS || perIp >= LOGIN_MAX_FAILS_PER_IP) throw tooMany("Too many failed attempts. Try again in 15 minutes.");
      const found = await tx.user.findUnique({ where: { email } });
      const ok = await verifyPassword(password, found?.passwordHash ?? (await getDummyHash()));
      if (!found || !ok || found.deletedAt) {
        await tx.loginAttempt.create({ data: { email, ip, createdAt: now } });
        return null;
      }
      if (found.suspendedAt) throw new ServiceError(403, "account_suspended", "This account has been suspended for breaking our rules.");
      await tx.loginAttempt.deleteMany({ where: { email, ip } });
      return found;
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
  if (!user) throw new ServiceError(401, "invalid_credentials", "Wrong email or password");
  const session = await createSession(db, user.id, { client: meta.client, now });
  return { user, session };
}

export async function pruneLoginAttempts(db: Db, now = new Date()) {
  const { count } = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  return count;
}

export async function logout(db: Db, token: string | undefined) {
  await destroySession(db, token);
}
