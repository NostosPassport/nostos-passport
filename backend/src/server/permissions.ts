import type { Actor } from "@/server/actor";
import { notFound, unauthorized } from "@/server/errors";

export function requireSignedIn(actor: Actor | null): Actor {
  if (!actor) throw unauthorized();
  return actor;
}

export function assertCanEditOwnContent(actor: Actor | null, content: { userId: string }): Actor {
  const a = requireSignedIn(actor);
  if (a.userId !== content.userId) throw notFound("Stamp not found");
  return a;
}
