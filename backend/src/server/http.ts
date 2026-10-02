import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { actorFromToken, type Actor } from "@/server/actor";
import { ServiceError, badRequest, forbidden, unauthorized } from "@/server/errors";

/** Reads one cookie from a raw Request (works in route handlers and in tests without Next's request scope). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

/**
 * Client IP for rate limiting: first hop of X-Forwarded-For (on Vercel that is the real client, set by the
 * edge), then X-Real-IP, else "unknown". Never used for authorization.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return (first || req.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

/**
 * How a request authenticates. If an Authorization header is present it is the only credential considered
 * (a malformed or unknown bearer token is unauthenticated, never a fallback to the cookie).
 */
export function credentials(req: Request): { kind: "bearer" | "cookie" | "none"; token: string | null } {
  const auth = req.headers.get("authorization");
  if (auth !== null) {
    // Auth scheme is case-insensitive (RFC 7235); tokens are base64url.
    const m = /^bearer\s+([A-Za-z0-9_-]{20,200})$/i.exec(auth.trim());
    return { kind: "bearer", token: m ? m[1]! : null };
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  return cookie ? { kind: "cookie", token: cookie } : { kind: "none", token: null };
}

/**
 * The caller, or null when anonymous. A request that *sends* a bearer token which doesn't resolve (malformed,
 * expired, revoked, or not an iOS session) gets 401 `invalid_token` on every route, public ones included,
 * so the app learns immediately that it must sign in again instead of silently seeing anonymous data.
 */
export async function getActor(req: Request): Promise<Actor | null> {
  const cred = credentials(req);
  if (cred.kind === "bearer") {
    const actor = cred.token ? await actorFromToken(prisma, cred.token, "IOS") : null;
    if (!actor) throw new ServiceError(401, "invalid_token", "Your session has expired. Sign in again.");
    return actor;
  }
  return cred.token ? actorFromToken(prisma, cred.token, "WEB") : null;
}

export async function requireActor(req: Request): Promise<Actor> {
  const actor = await getActor(req);
  if (!actor) throw unauthorized();
  return actor;
}

/**
 * CSRF defense for cookie-authenticated mutations: SameSite=Lax cookies plus an Origin check.
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, so a mismatch is rejected.
 * Bearer-authenticated requests (the iOS app) are exempt: a cross-site page can't attach an Authorization
 * header without a CORS preflight, which this API never grants, and the cookie is ignored when a bearer
 * header is present.
 */
export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  if (credentials(req).kind === "bearer") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (tests, curl) don't send Origin; cookies are still SameSite=Lax
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Bad origin");
  }
  if (!host || originHost !== host) throw forbidden("Cross-origin request rejected");
}

/** Reads a JSON body without validating it; the service layer owns validation (and may transform values). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  return schema.parse(raw);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: same-origin check for mutations and uniform error mapping. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ServiceError) {
    const headers: Record<string, string> = {};
    if (err.code === "invalid_token") headers["www-authenticate"] = 'Bearer error="invalid_token"';
    else if (err.status === 401) headers["www-authenticate"] = 'Bearer realm="nostos"';
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid_input", message: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  // A database backstop fired (the service checks first, so this is a race at a boundary, e.g. a rating edit that
  // commits just after 5am). The triggers' messages start with "lastcall:"; answer 409 with that sentence.
  const guard = err instanceof Error ? /lastcall: ([^\n"]+)/.exec(err.message) : null;
  if (guard) {
    const text = guard[1]!.trim();
    return NextResponse.json({ error: "conflict", message: text.charAt(0).toUpperCase() + text.slice(1) }, { status: 409 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "internal", message: "Something went wrong" }, { status: 500 });
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
