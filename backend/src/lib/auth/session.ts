import { createHash, randomBytes } from "node:crypto";
import type { SessionClient } from "@prisma/client";
import type { Db } from "@/lib/db";
import { DAY_MS } from "@/lib/time";

export const SESSION_COOKIE = "lc_session";
/** Fixed (non-sliding) lifetimes: the cookie (or keychain token) and the DB row expire together. */
export const SESSION_TTL_MS = 30 * DAY_MS;
/** iOS tokens live in the keychain; a longer fixed lifetime avoids monthly forced sign-outs. */
export const IOS_SESSION_TTL_MS = 90 * DAY_MS;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, userId: string, opts: { client?: SessionClient; now?: Date } = {}) {
  const client = opts.client ?? "WEB";
  const now = opts.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + (client === "IOS" ? IOS_SESSION_TTL_MS : SESSION_TTL_MS));
  await db.session.create({ data: { id: hashToken(token), userId, client, expiresAt, createdAt: now } });
  return { token, expiresAt, client };
}

/**
 * Resolves a session token to its user. When `client` is given, the session must have been issued for that
 * channel: IOS tokens only work as bearer tokens and WEB tokens only as the cookie, so a leaked 90-day iOS
 * token can't be replayed as a browser cookie (and vice versa).
 */
export async function getSessionUser(
  db: Db,
  token: string | undefined | null,
  opts: { client?: SessionClient; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (opts.client && session.client !== opts.client) return null;
  if (session.user.deletedAt) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function destroySession(db: Db, token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Revokes every session (web and iOS) for a user. Returns how many were revoked. */
export async function destroyAllSessions(db: Db, userId: string) {
  const { count } = await db.session.deleteMany({ where: { userId } });
  return count;
}

export function sessionCookieAttributes(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
