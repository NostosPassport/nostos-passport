import type { Role, SessionClient } from "@prisma/client";
import type { Db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/** The authenticated caller, as seen by the service layer. Every permission check takes one of these. */
export type Actor = {
  userId: string;
  role: Role;
  handle: string;
  displayName: string;
  /** Venues with an APPROVED claim. Only meaningful for VENUE_OWNER. */
  ownedVenueIds: string[];
  /** App Review / QA account: may post from anywhere; its posts never count (see DECISIONS.md). */
  geofenceExempt: boolean;
};

export async function loadActor(db: Db, userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { claims: { where: { status: "APPROVED" }, select: { venueId: true } } },
  });
  if (!user || user.deletedAt || user.suspendedAt) return null;
  return {
    userId: user.id,
    role: user.role,
    handle: user.handle,
    displayName: user.displayName,
    ownedVenueIds: user.role === "VENUE_OWNER" ? user.claims.map((c) => c.venueId) : [],
    geofenceExempt: user.geofenceExempt,
  };
}

export async function actorFromToken(db: Db, token: string | undefined | null, client?: SessionClient): Promise<Actor | null> {
  const user = await getSessionUser(db, token, { client });
  return user ? loadActor(db, user.id) : null;
}
