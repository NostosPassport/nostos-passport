import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { actorFromToken, type Actor } from "@/server/actor";
import { ServiceError, badRequest, forbidden, unauthorized } from "@/server/errors";

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

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return (first || req.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

export function credentials(req: Request): { kind: "bearer" | "cookie" | "none"; token: string | null } {
  const auth = req.headers.get("authorization");
  if (auth !== null) {
    const m = /^bearer\s+([A-Za-z0-9_-]{20,200})$/i.exec(auth.trim());
    return { kind: "bearer", token: m ? m[1]! : null };
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  return cookie ? { kind: "cookie", token: cookie } : { kind: "none", token: null };
}

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

export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  if (credentials(req).kind === "bearer") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { throw forbidden("Bad origin"); }
  if (!host || originHost !== host) throw forbidden("Cross-origin request rejected");
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw badRequest("Body must be JSON"); }
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw badRequest("Body must be JSON"); }
  return schema.parse(raw);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

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
    if (err.status >= 500) console.error("[api] service error", { status: err.status, code: err.code, message: err.message });
    const headers: Record<string, string> = {};
    if (err.code === "invalid_token") headers["www-authenticate"] = 'Bearer error="invalid_token"';
    else if (err.status === 401) headers["www-authenticate"] = 'Bearer realm="nostos"';
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "invalid_input", message: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") }, { status: 400 });
  }
  const guard = err instanceof Error ? /lastcall: ([^\n"]+)/.exec(err.message) : null;
  if (guard) {
    const text = guard[1]!.trim();
    return NextResponse.json({ error: "conflict", message: text.charAt(0).toUpperCase() + text.slice(1) }, { status: 409 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "internal", message: "Something went wrong" }, { status: 500 });
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
