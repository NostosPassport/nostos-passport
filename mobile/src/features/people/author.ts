import type { AuthorView } from "@/api/contracts";

/**
 * Authors arrive resolved for this viewer (the server decides): a handle, "Anonymous" (a private account you
 * don't follow: no handle, no link) or "Deleted user".
 */
export function authorHandle(a: AuthorView): string | null {
  return a.kind === "user" ? a.handle : null;
}

export function authorLabel(a: AuthorView): string {
  return a.kind === "user" ? `@${a.handle}` : a.kind === "anonymous" ? "Anonymous" : "Deleted user";
}
