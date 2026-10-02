import Link from "next/link";
import type { Actor } from "@/server/actor";
import { LogoutButton } from "@/components/LogoutButton";

/** Compact account menu for the full-screen map (a native <details> dropdown, so it works without JS). */
export function NavMenu({ actor }: { actor: Actor | null }) {
  if (!actor) {
    return (
      <Link href="/login" className="block rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-ink">
        Sign in
      </Link>
    );
  }
  const item = "block rounded-lg px-3 py-2 text-sm hover:bg-panel-2";
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-panel-2 px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        @{actor.handle} <span className="text-muted">▾</span>
      </summary>
      <nav className="absolute right-0 mt-2 w-48 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
        <Link href={`/u/${actor.handle}`} className={item}>Profile</Link>
        <Link href="/people" className={item}>People &amp; friends</Link>
        {actor.role === "VENUE_OWNER" && <Link href="/owner" className={`${item} text-venue`}>My venues</Link>}
        {actor.role === "USER" && <Link href="/owner" className={item}>Claim a venue</Link>}
        {(actor.role === "MODERATOR" || actor.role === "ADMIN") && <Link href="/mod" className={`${item} text-warn`}>Moderation</Link>}
        {actor.role === "ADMIN" && <Link href="/admin" className={`${item} text-warn`}>Admin</Link>}
        <div className="px-3 py-2"><LogoutButton className="text-sm text-muted hover:text-text" /></div>
      </nav>
    </details>
  );
}
