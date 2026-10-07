import { Prisma, type SessionClient } from "@prisma/client";
import { z } from "zod";

import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import type { Db } from "@/lib/db";
import { isOldEnough, MIN_AGE, parseBirthdate } from "@/lib/age";
import { assertCleanText, conflict, notFound, ServiceError } from "@/server/errors";
import { consumeEmailChallenge, startEmailChallenge } from "@/server/services/email-code";

export const CURRENT_TERMS_VERSION = "2026-10-02";

const email = z.string().trim().toLowerCase().email().max(200);
const challenge = z.object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code") });

export const signupStartSchema = z
  .object({
    email,
    displayName: z.string().trim().min(1).max(60),
    birthdate: z.string().refine((v) => parseBirthdate(v) !== null, "Enter your birthdate as YYYY-MM-DD"),
  })
  .strict();

export const signupSchema = challenge
  .extend({
    displayName: z.string().trim().min(1).max(60),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Handle must be at least 3 characters")
      .max(30, "Handle must be 30 characters or fewer")
      .regex(/^[a-z0-9._]+$/, "Handle can use lowercase letters, numbers, periods and underscores"),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "You need to accept the Terms and Privacy Policy" }) }),
  })
  .strict();

export const loginStartSchema = z.object({ email }).strict();
export const loginSchema = challenge.strict();
export const devLoginSchema = z.object({ email, password: z.string().max(200) }).strict();

export const UNDERAGE_MESSAGE = `You need to be ${MIN_AGE} or older to use Nostos`;

export async function startSignup(db: Db, input: unknown, meta: { ip: string; now?: Date }) {
  const data = signupStartSchema.parse(input);
  const now = meta.now ?? new Date();
  if (!isOldEnough(data.birthdate, now)) throw new ServiceError(403, "underage", UNDERAGE_MESSAGE);
  assertCleanText({ "display name": data.displayName });
  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true, deletedAt: true } });
  if (existing && !existing.deletedAt) throw conflict("Email already registered");
  return startEmailChallenge(db, { email: data.email, purpose: "SIGN_UP", ip: meta.ip, displayName: data.displayName, now });
}

export async function signup(db: Db, input: unknown, opts: { client?: SessionClient; now?: Date } = {}) {
  const data = signupSchema.parse(input);
  const now = opts.now ?? new Date();
  const { email: verifiedEmail } = await consumeEmailChallenge(db, {
    challengeId: data.challengeId,
    code: data.code,
    purpose: "SIGN_UP",
    now,
  });

  assertCleanText({ handle: data.handle, "display name": data.displayName });
  const existing = await db.user.findFirst({ where: { OR: [{ email: verifiedEmail }, { handle: data.handle }] } });
  if (existing) throw conflict(existing.email === verifiedEmail ? "Email already registered" : "Handle taken");

  const user = await db.user
    .create({
      data: {
        email: verifiedEmail,
        handle: data.handle,
        displayName: data.displayName,
        passwordHash: null,
        emailVerifiedAt: now,
        ageVerifiedAt: now,
        role: "USER",
        termsAcceptedAt: now,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    })
    .catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict("Email or handle already taken");
      throw err;
    });
  const session = await createSession(db, user.id, { client: opts.client, now });
  return { user, session };
}

export async function startLogin(db: Db, input: unknown, meta: { ip: string; now?: Date }) {
  const data = loginStartSchema.parse(input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || user.deletedAt) throw notFound("No Nostos account uses that email.");
  if (user.suspendedAt) throw new ServiceError(403, "account_suspended", "This account has been suspended for breaking our rules.");
  return startEmailChallenge(db, { email: data.email, purpose: "SIGN_IN", ip: meta.ip, displayName: user.displayName, now: meta.now });
}

export async function login(
  db: Db,
  input: unknown,
  meta: { client?: SessionClient; now?: Date } = {},
) {
  const data = loginSchema.parse(input);
  const now = meta.now ?? new Date();
  const { email: verifiedEmail } = await consumeEmailChallenge(db, {
    challengeId: data.challengeId,
    code: data.code,
    purpose: "SIGN_IN",
    now,
  });
  const user = await db.user.findUnique({ where: { email: verifiedEmail } });
  if (!user || user.deletedAt) throw new ServiceError(401, "invalid_credentials", "That sign-in code is no longer valid.");
  if (user.suspendedAt) throw new ServiceError(403, "account_suspended", "This account has been suspended for breaking our rules.");
  const session = await createSession(db, user.id, { client: meta.client, now });
  return { user, session };
}

export async function devLogin(db: Db, input: unknown, opts: { client?: SessionClient; now?: Date } = {}) {
  if (process.env.NODE_ENV !== "development") throw notFound();
  const data = devLoginSchema.parse(input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  const ok = await verifyPassword(data.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok || user.deletedAt) throw new ServiceError(401, "invalid_credentials", "Wrong development credential");
  const session = await createSession(db, user.id, { client: opts.client, now: opts.now });
  return { user, session };
}

export async function pruneLoginAttempts(db: Db, now = new Date()) {
  const { count } = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  return count;
}

export async function logout(db: Db, token: string | undefined) {
  await destroySession(db, token);
}
