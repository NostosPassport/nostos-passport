import Link from "next/link";
import type { Actor } from "@/server/actor";
import { LogoutButton } from "@/components/LogoutButton";

export function TopBar({ actor, title, back = "/" }: { actor: Actor | null; title?: string; back?: string | null }) {
  return (
    <header className="sticky top-0 z-[1000] flex items-center gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
      {back ? (
        <Link href={back} className="-ml-1 rounded-full px-2 py-1 text-lg text-muted hover:text-text" aria-label="Back">
          ←
        </Link>
      ) : (
        <Link href="/" className="font-bold tracking-tight text-accent">
          Nostos
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold max-sm:sr-only">{title}</h1>
      <span className="flex-1 sm:hidden" />
      <NavLinks actor={actor} />
    </header>
  );
}

export function NavLinks({ actor }: { actor: Actor | null }) {
  if (!actor) {
    return (
      <Link href="/login" className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-ink">
        Sign in
      </Link>
    );
  }
  return (
    <nav className="flex items-center gap-1.5 whitespace-nowrap text-sm">
      {actor.role === "VENUE_OWNER" && (
        <Link href="/owner" className="rounded-full border border-line px-2.5 py-1 text-venue">
          Venue
        </Link>
      )}
      {(actor.role === "MODERATOR" || actor.role === "ADMIN") && (
        <Link href="/mod" className="rounded-full border border-line px-2.5 py-1 text-warn">
          Mod
        </Link>
      )}
      {actor.role === "ADMIN" && (
        <Link href="/admin" className="rounded-full border border-line px-2.5 py-1 text-warn">
          Admin
        </Link>
      )}
      <Link href="/people" className="rounded-full border border-line px-2.5 py-1" aria-label="People">
        👥
      </Link>
      <Link href={`/u/${actor.handle}`} className="rounded-full bg-panel-2 px-2.5 py-1">
        @{actor.handle}
      </Link>
      <LogoutButton />
    </nav>
  );
}
