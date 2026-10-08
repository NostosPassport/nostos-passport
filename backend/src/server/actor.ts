import type { SessionClient } from "@prisma/client";
import type { Db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export type Actor = {
  userId: string;
  handle: string;
  displayName: string;
  geofenceExempt: boolean;
};

export async function loadActor(db: Db, userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return null;
  return { userId: user.id, handle: user.handle, displayName: user.displayName, geofenceExempt: user.geofenceExempt };
}

export async function actorFromToken(db: Db, token: string | undefined | null, client?: SessionClient): Promise<Actor | null> {
  const user = await getSessionUser(db, token, { client });
  return user ? loadActor(db, user.id) : null;
}
