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
const displayName = z.string().trim().min(1).max(60);
const handle = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must be 30 characters or fewer")
  .regex(/^[a-z0-9._]+$/, "Handle can use lowercase letters, numbers, periods and underscores");
const loginIdentifier = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email or handle")
  .max(200)
  .refine((value) => email.safeParse(value).success || handle.safeParse(value).success, "Enter a valid email or handle");
const acceptTerms = z.literal(true, { errorMap: () => ({ message: "You need to accept the Terms and Privacy Policy" }) });
const challenge = z.object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code") });

export const signupStartSchema = z
  .object({
    email,
    displayName,
    handle,
    acceptTerms,
    birthdate: z.string().refine((v) => parseBirthdate(v) !== null, "Enter your birthdate as YYYY-MM-DD"),
  })
  .strict();

export const signupSchema = challenge.extend({ displayName, handle, acceptTerms }).strict();

export const loginStartSchema = z.object({ identifier: loginIdentifier }).strict();
export const loginSchema = challenge.strict();
export const devLoginSchema = z.object({ email, password: z.string().max(200) }).strict();

export const UNDERAGE_MESSAGE = `You need to be ${MIN_AGE} or older to use Nostos`;

function signupConflict(existing: { email: string; handle: string }, emailToCheck: string, handleToCheck: string) {
  return conflict(existing.email === emailToCheck ? "Email already registered" : existing.handle === handleToCheck ? "Handle taken" : "Email or handle already taken");
}

async function reopenSignupChallenge(db: Db, challengeId: string, consumedAt: Date) {
  await db.emailChallenge.updateMany({ where: { id: challengeId, purpose: "SIGN_UP", consumedAt }, data: { consumedAt: null } }).catch(() => {});
}

export async function startSignup(db: Db, input: unknown, meta: { ip: string; now?: Date }) {
  const data = signupStartSchema.parse(input);
  const now = meta.now ?? new Date();
  if (!isOldEnough(data.birthdate, now)) throw new ServiceError(403, "underage", UNDERAGE_MESSAGE);
  assertCleanText({ handle: data.handle, "display name": data.displayName });
  const existing = await db.user.findFirst({
    where: { OR: [{ email: data.email }, { handle: data.handle }] },
    select: { email: true, handle: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) throw signupConflict(existing, data.email, data.handle);
  return startEmailChallenge(db, { email: data.email, purpose: "SIGN_UP", ip: meta.ip, displayName: data.displayName, now });
}

export async function signup(db: Db, input: unknown, opts: { client?: SessionClient; now?: Date } = {}) {
  const data = signupSchema.parse(input);
  const now = opts.now ?? new Date();
  assertCleanText({ handle: data.handle, "display name": data.displayName });

  const pending = await db.emailChallenge.findUnique({
    where: { id: data.challengeId },
    select: { email: true, purpose: true },
  });
  const pendingEmail = pending?.purpose === "SIGN_UP" ? pending.email : null;
  const beforeVerification = await db.user.findFirst({
    where: { OR: [...(pendingEmail ? [{ email: pendingEmail }] : []), { handle: data.handle }] },
    select: { email: true, handle: true, deletedAt: true },
  });
  if (beforeVerification && !beforeVerification.deletedAt) {
    throw signupConflict(beforeVerification, pendingEmail ?? "", data.handle);
  }

  const { email: verifiedEmail } = await consumeEmailChallenge(db, {
    challengeId: data.challengeId,
    code: data.code,
    purpose: "SIGN_UP",
    now,
  });

  const existing = await db.user.findFirst({
    where: { OR: [{ email: verifiedEmail }, { handle: data.handle }] },
    select: { email: true, handle: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) {
    await reopenSignupChallenge(db, data.challengeId, now);
    throw signupConflict(existing, verifiedEmail, data.handle);
  }

  let user;
  try {
    user = await db.user.create({
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
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await reopenSignupChallenge(db, data.challengeId, now);
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target ?? "");
      if (target.includes("handle")) throw conflict("Handle taken");
      if (target.includes("email")) throw conflict("Email already registered");
      throw conflict("Email or handle already taken");
    }
    throw err;
  }

  const session = await createSession(db, user.id, { client: opts.client, now });
  return { user, session };
}

export async function startLogin(db: Db, input: unknown, meta: { ip: string; now?: Date }) {
  const data = loginStartSchema.parse(input);
  const user = await db.user.findUnique({
    where: data.identifier.includes("@") ? { email: data.identifier } : { handle: data.identifier },
  });
  if (!user || user.deletedAt) throw notFound("No Nostos account uses that email or handle.");
  if (user.suspendedAt) throw new ServiceError(403, "account_suspended", "This account has been suspended for breaking our rules.");
  return startEmailChallenge(db, { email: user.email, purpose: "SIGN_IN", ip: meta.ip, displayName: user.displayName, now: meta.now });
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
