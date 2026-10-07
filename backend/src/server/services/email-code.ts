import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { EmailChallengePurpose } from "@prisma/client";

import type { Db } from "@/lib/db";
import { ServiceError, tooMany } from "@/server/errors";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const RATE_WINDOW_MS = 60 * 60_000;
const MAX_SENDS_PER_EMAIL = 5;
const MAX_SENDS_PER_IP = 25;
const MAX_ATTEMPTS = 5;
const RETENTION_MS = 24 * 60 * 60_000;

function codeSecret(): string {
  const configured = process.env.AUTH_CODE_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "nostos-development-auth-code-secret-change-before-production";
  throw new ServiceError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");
}

function digest(id: string, code: string): string {
  return createHmac("sha256", codeSecret()).update(`${id}:${code}`).digest("hex");
}

function sameDigest(a: string, b: string): boolean {
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function actionFor(purpose: EmailChallengePurpose): string {
  if (purpose === "DELETE_ACCOUNT") return "confirm deleting your Nostos account";
  if (purpose === "CHANGE_EMAIL") return "confirm this email address";
  return "continue with Nostos";
}

function localMessage(code: string, purpose: EmailChallengePurpose): string {
  return `Your Nostos verification code is ${code}. It expires in 10 minutes. Use it to ${actionFor(purpose)}. If you didn't request this, you can ignore this email.`;
}

function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function sender(): string {
  return process.env.AUTH_EMAIL_FROM?.trim() || "Nostos <login@auth.nostospassport.com>";
}

async function postResend(body: Record<string, unknown>, idempotencyKey: string): Promise<void> {
  const key = resendApiKey();
  if (!key) throw new ServiceError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ServiceError(503, "email_unavailable", "We couldn't send that email. Try again in a moment.");
  }

  if (!response.ok) {
    console.error("[auth-email] Resend rejected an email", response.status, await response.text().catch(() => ""));
    throw new ServiceError(503, "email_unavailable", "We couldn't send that email. Try again in a moment.");
  }
}

async function deliverVerification(to: string, code: string, purpose: EmailChallengePurpose, idempotencyKey: string): Promise<void> {
  const key = resendApiKey();
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth-email] ${to}: ${localMessage(code, purpose)}`);
      return;
    }
    throw new ServiceError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");
  }

  const templateId = process.env.RESEND_VERIFY_EMAIL_TEMPLATE_ID?.trim();
  if (!templateId) {
    throw new ServiceError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");
  }

  await postResend(
    {
      from: sender(),
      to: [to],
      template: {
        id: templateId,
        variables: {
          CODE: code,
        },
      },
    },
    idempotencyKey,
  );
}

async function deliverRaw(to: string, subject: string, text: string, html: string, idempotencyKey: string): Promise<void> {
  const key = resendApiKey();
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth-email] ${to}: ${text}`);
      return;
    }
    throw new ServiceError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");
  }

  await postResend({ from: sender(), to: [to], subject, text, html }, idempotencyKey);
}

export type StartedEmailChallenge = { challengeId: string; expiresAt: string; resendAfterSeconds: number };

export async function startEmailChallenge(
  db: Db,
  input: { email: string; purpose: EmailChallengePurpose; ip: string; now?: Date },
): Promise<StartedEmailChallenge> {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const ip = input.ip.slice(0, 64) || "unknown";
  const cooldownSince = new Date(now.getTime() - RESEND_COOLDOWN_MS);
  const hourSince = new Date(now.getTime() - RATE_WINDOW_MS);

  const [recent, emailCount, ipCount] = await Promise.all([
    db.emailChallenge.findFirst({ where: { email, purpose: input.purpose, createdAt: { gt: cooldownSince } }, orderBy: { createdAt: "desc" } }),
    db.emailChallenge.count({ where: { email, createdAt: { gt: hourSince } } }),
    db.emailChallenge.count({ where: { ip, createdAt: { gt: hourSince } } }),
  ]);
  if (recent) throw tooMany("Wait a minute before requesting another code.");
  if (emailCount >= MAX_SENDS_PER_EMAIL || ipCount >= MAX_SENDS_PER_IP) throw tooMany("Too many verification emails. Try again later.");

  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await db.emailChallenge.create({
    data: { id, email, codeHash: digest(id, code), purpose: input.purpose, ip, expiresAt, createdAt: now },
  });

  try {
    await deliverVerification(email, code, input.purpose, `nostos-auth/${id}`);
  } catch (error) {
    await db.emailChallenge.delete({ where: { id } }).catch(() => {});
    throw error;
  }

  return { challengeId: id, expiresAt: expiresAt.toISOString(), resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

export async function consumeEmailChallenge(
  db: Db,
  input: { challengeId: string; code: string; purpose: EmailChallengePurpose; expectedEmail?: string; now?: Date },
): Promise<{ email: string }> {
  const now = input.now ?? new Date();
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) throw new ServiceError(400, "invalid_code", "Enter the six-digit code from your email.");

  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`email-challenge:${input.challengeId}`}))`;
    const challenge = await tx.emailChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge || challenge.purpose !== input.purpose || challenge.consumedAt) return { kind: "invalid" as const };
    if (input.expectedEmail && challenge.email !== input.expectedEmail.trim().toLowerCase()) return { kind: "invalid" as const };
    if (challenge.expiresAt <= now) return { kind: "expired" as const };
    if (challenge.attempts >= MAX_ATTEMPTS) return { kind: "locked" as const };

    if (!sameDigest(challenge.codeHash, digest(challenge.id, code))) {
      const attempts = challenge.attempts + 1;
      await tx.emailChallenge.update({ where: { id: challenge.id }, data: { attempts } });
      return { kind: attempts >= MAX_ATTEMPTS ? ("locked" as const) : ("wrong" as const) };
    }

    await tx.emailChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
    return { kind: "ok" as const, email: challenge.email };
  });

  if (result.kind === "ok") return { email: result.email };
  if (result.kind === "expired") throw new ServiceError(400, "code_expired", "That code has expired. Request a new one.");
  if (result.kind === "locked") throw tooMany("Too many incorrect attempts. Request a new code.");
  if (result.kind === "wrong") throw new ServiceError(400, "invalid_code", "That code is not correct.");
  throw new ServiceError(400, "invalid_code", "That verification code is no longer valid.");
}

export async function sendAccountEmailChangedNotice(oldEmail: string, newEmail: string): Promise<void> {
  const text = `The email address on your Nostos account was changed to ${newEmail}. If you didn't make this change, contact support immediately.`;
  const html = `<p>The email address on your Nostos account was changed to <strong>${newEmail}</strong>.</p><p>If you didn't make this change, contact support immediately.</p>`;
  await deliverRaw(oldEmail, "Your Nostos email was changed", text, html, `nostos-email-changed/${randomUUID()}`);
}

export async function pruneEmailChallenges(db: Db, now = new Date()): Promise<number> {
  const { count } = await db.emailChallenge.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
  return count;
}
