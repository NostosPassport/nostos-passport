import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { FollowButton } from "@/components/social/FollowButton";
import { BlockReport } from "@/components/social/BlockReport";
import { getCurrentActor } from "@/server/current";
import { ServiceError } from "@/server/errors";
import { getProfile } from "@/server/services/people";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const actor = await getCurrentActor();
  let p;
  try {
    p = await getProfile(prisma, (await params).handle, actor);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  const rel = p.relationship;
  if (p.access === "limited") {
    return (
      <>
        <TopBar actor={actor} title={`@${p.user.handle}`} />
        <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div aria-hidden className="h-14 w-14 rounded-full bg-panel-2" />
              <p className="text-lg font-bold">@{p.user.handle}{p.user.verified && " ✓"}</p>
            </div>
            {actor && !rel.isSelf && <FollowButton handle={p.user.handle} initial={rel.follow} />}
          </div>
          <section className="rounded-2xl bg-panel p-4 text-sm">
            <h3 className="font-semibold">This account is private</h3>
            <p className="mt-1 text-muted">Follow it to see their posts, places and plans. They approve every request.</p>
          </section>
          {actor && !rel.isSelf && <BlockReport handle={p.user.handle} />}
        </main>
      </>
    );
  }
  const u = p.user;
  return (
    <>
      <TopBar actor={actor} title={`@${u.handle}`} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {u.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL from our own storage
              <img src={u.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div aria-hidden className="h-14 w-14 rounded-full bg-panel-2" />
            )}
            <div>
              <h2 className="text-xl font-bold">{u.displayName}</h2>
              <p className="text-sm text-muted">
                @{u.handle}{u.verified && " ✓"}
                {u.isVenueAccount && <span className="ml-2 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase">Venue account</span>}
                {u.isPrivate && <span className="ml-2 text-[11px]">Private</span>}
              </p>
            </div>
          </div>
          {actor && !rel.isSelf && <FollowButton handle={u.handle} initial={rel.follow} />}
        </div>
        {u.bio && <p className="whitespace-pre-line text-sm">{u.bio}</p>}
        <p className="text-xs text-muted">Member since {u.memberSince.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "America/New_York" })}</p>
        {actor && !rel.isSelf && <BlockReport handle={u.handle} />}
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["posts", u.counts.posts],
            ["followers", u.counts.followers],
            ["following", u.counts.following],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-panel p-2">
              <dd className="text-lg font-bold">{v}</dd>
              <dt className="text-[11px] text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        {u.reputation !== null && (
        <div className="rounded-2xl bg-panel p-3 text-sm">
          <span className="text-muted">Reputation weight </span>
          <span className="font-semibold">{u.reputation.toFixed(2)}</span>
          <p className="mt-1 text-xs text-muted">Private: only you{rel.isSelf ? "" : " (and moderators)"} can see this. From 0.2 to 1.5. New accounts start at 0.5; it rises when reports match what others see and falls when they don&apos;t.</p>
        </div>
        )}
        {u.venues.length > 0 && (
          <div className="rounded-2xl border border-venue/40 bg-panel p-3 text-sm">
            <div className="text-xs uppercase tracking-wider text-venue">Manages</div>
            {u.venues.map((v) => (
              <Link key={v.slug} href={`/v/${v.slug}`} className="block py-0.5">{v.name}</Link>
            ))}
          </div>
        )}
        <section className="rounded-2xl bg-panel p-3">
          <h3 className="text-sm font-semibold">Going tonight</h3>
          {p.goingTonight === null ? (
            <p className="mt-1 text-sm text-muted">
              Plans are shared with mutual follows only{rel.follow === "following" ? `. @${u.handle} hasn't followed you back yet.` : "."}
            </p>
          ) : p.goingTonight.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No plans yet.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {p.goingTonight.map((v) => (
                <li key={v.slug}><Link href={`/v/${v.slug}`} className="text-accent">{v.name}</Link></li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
