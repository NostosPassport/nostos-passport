import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { PeopleSearch } from "@/components/social/PeopleSearch";
import { getCurrentActor } from "@/server/current";
import { listFollowing } from "@/server/services/people";
import { listBlocks } from "@/server/services/blocks";
import { UnblockButton } from "@/components/social/BlockReport";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/people");
  const [following, blocks] = await Promise.all([listFollowing(prisma, actor), listBlocks(prisma, actor)]);
  const out = following.filter((f) => f.goingTonight.length > 0);
  return (
    <>
      <TopBar actor={actor} title="People" />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
        <PeopleSearch />
        <section>
          <h2 className="mb-2 text-sm font-semibold">Friends out tonight ({out.length})</h2>
          <p className="-mt-1 mb-2 text-xs text-muted">Friends are mutual follows; plans are only shared between mutuals.</p>
          {out.length === 0 ? (
            <p className="rounded-2xl bg-panel p-4 text-center text-sm text-muted">Nobody you follow has RSVP&apos;d yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
              {out.map((f) => (
                <li key={f.handle} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <Link href={`/u/${f.handle}`} className="font-medium">@{f.handle}</Link>
                  <span className="truncate text-right text-muted">
                    {f.goingTonight.map((v, i) => (
                      <span key={v.slug}>{i > 0 && ", "}<Link href={`/v/${v.slug}`} className="text-accent">{v.name}</Link></span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Following ({following.length})</h2>
          {following.length === 0 ? (
            <p className="rounded-2xl bg-panel p-4 text-center text-sm text-muted">Search above to follow people and see where they&apos;re headed.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {following.map((f) => (
                <li key={f.handle}><Link href={`/u/${f.handle}`} className="block rounded-full bg-panel px-3 py-1 text-sm">@{f.handle}</Link></li>
              ))}
            </ul>
          )}
        </section>
        {blocks.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Blocked ({blocks.length})</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
              {blocks.map((b) => (
                <li key={b.ref} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span>{b.handle ? `@${b.handle}` : `Someone you blocked from a ${b.source}`}</span>
                  <UnblockButton blockRef={b.ref} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
