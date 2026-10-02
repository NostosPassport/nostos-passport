import type { AuthorView } from "@/server/privacy";

/** How an author reads on the web: "@handle", "Anonymous" (private, not followed) or "Deleted user". */
export function authorLabel(a: AuthorView): string {
  return a.kind === "user" ? `@${a.handle}${a.verified ? " ✓" : ""}` : a.kind === "anonymous" ? "Anonymous" : "Deleted user";
}
