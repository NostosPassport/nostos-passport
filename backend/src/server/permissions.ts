/**
 * Central permission checks for the service layer. Every mutating service calls one of these before touching
 * the database; the UI hiding a button is never the enforcement point.
 *
 * Checks and balances:
 *  - Venues own the facts: only an approved owner of a venue may edit its official info / promos / replies.
 *  - Users own the reality: only the author may edit their own comment; nobody may delete user content;
 *    only MODERATOR/ADMIN may hide or restore it. A VENUE_OWNER gets 403 on any attempt to modify user
 *    content (invariant 1), and cannot post "user reality" (reports, photos, top-level comments) for a
 *    venue they own.
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

export function ownsVenue(actor: Actor | null, venueId: string): boolean {
  return Boolean(actor && actor.role === "VENUE_OWNER" && actor.ownedVenueIds.includes(venueId));
}

export function assertOwnsVenue(actor: Actor | null, venueId: string): Actor {
  const a = requireSignedIn(actor);
  if (!ownsVenue(a, venueId)) throw forbidden("Only an approved owner of this venue can do that");
  return a;
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

/** Users own the reality: a venue's own account cannot post reports/photos/top-level comments for it. */
export function assertCanPostUserContent(actor: Actor | null, venueId: string): Actor {
  const a = requireSignedIn(actor);
  if (ownsVenue(a, venueId)) {
    throw forbidden("Venue accounts can't post live reports, photos or comments for their own venue. Reply to comments instead.");
  }
  return a;
}

/**
 * Editing user-generated content: author only. Venue owners get an explicit 403 even for content at their venue;
 * moderators don't edit (they hide), so they're refused too.
 */
export function assertCanEditOwnContent(actor: Actor | null, content: { userId: string; venueId: string }): Actor {
  const a = requireSignedIn(actor);
  if (a.userId !== content.userId) {
    throw forbidden(ownsVenue(a, content.venueId) ? "Venues can't edit user content. Flag it for a moderator instead." : "You can only edit your own content");
  }
  return a;
}

/** Hiding / restoring user content is a moderator decision (invariant 1: never the venue's). */
export function assertCanModerateContent(actor: Actor | null): Actor {
  const a = requireSignedIn(actor);
  if (!isModerator(a)) {
    throw forbidden(a.role === "VENUE_OWNER" ? "Venues can't hide user content. Flag it and a moderator will review." : "Moderators only");
  }
  return a;
}
