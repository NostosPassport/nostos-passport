import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { actorFromToken, type Actor } from "@/server/actor";

/** Current actor for Server Components (one lookup per request). */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const store = await cookies();
  return actorFromToken(prisma, store.get(SESSION_COOKIE)?.value, "WEB");
});
