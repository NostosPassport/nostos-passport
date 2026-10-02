import type { Role, SessionClient } from "@prisma/client";
import type { Db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/** The authenticated caller, as seen by the service layer. Every permission check takes one of these. */
export type Actor = {
  userId: string;
  role: Role;
  handle: string;
  displayName: string;
  /** App Review / QA account: may stamp from anywhere; its stamps are visible only to itself. */
  geofenceExempt: boolean;
};

export async function loadActor(db: Db, userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt || user.suspendedAt) return null;
  return {
    userId: user.id,
    role: user.role,
    handle: user.handle,
    displayName: user.displayName,
    geofenceExempt: user.geofenceExempt,
  };
}

export async function actorFromToken(db: Db, token: string | undefined | null, client?: SessionClient): Promise<Actor | null> {
  const user = await getSessionUser(db, token, { client });
  return user ? loadActor(db, user.id) : null;
}
