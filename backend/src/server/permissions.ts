/**
 * Central permission checks for the service layer. Every mutating service calls one of these before touching
 * the database; the UI hiding a button is never the enforcement point.
 *
 * Users own their stamps: only the author may edit one, nobody may delete one, and only MODERATOR/ADMIN may hide or
 * restore user content.
 */
import type { Actor } from "@/server/actor";
import { forbidden, unauthorized } from "@/server/errors";

export function requireSignedIn(actor: Actor | null): Actor {
  if (!actor) throw unauthorized();
  return actor;
}

export function isModerator(actor: Actor | null): boolean {
  return actor?.role === "MODERATOR" || actor?.role === "ADMIN";
}

export function assertModerator(actor: Actor | null): Actor {
  const a = requireSignedIn(actor);
  if (!isModerator(a)) throw forbidden("Moderators only");
  return a;
}

export function assertAdmin(actor: Actor | null): Actor {
  const a = requireSignedIn(actor);
  if (a.role !== "ADMIN") throw forbidden("Admins only");
  return a;
}

/** Editing user-generated content: author only. Moderators don't edit (they hide), so they're refused too. */
export function assertCanEditOwnContent(actor: Actor | null, content: { userId: string }): Actor {
  const a = requireSignedIn(actor);
  if (a.userId !== content.userId) throw forbidden("You can only edit your own content");
  return a;
}

/** Hiding / restoring user content is a moderator decision. */
export function assertCanModerateContent(actor: Actor | null): Actor {
  return assertModerator(actor);
}
