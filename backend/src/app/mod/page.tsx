import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatAge } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ModActions } from "@/components/mod/ModActions";
import { getCurrentActor } from "@/server/current";
import { isModerator } from "@/server/permissions";
import { moderationQueue, recentModerationLog } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export default async function ModPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/mod");
  if (!isModerator(actor)) notFound();
  const [queue, log] = await Promise.all([moderationQueue(prisma, actor), recentModerationLog(prisma, actor)]);
  const now = new Date();
  return (
    <>
      <TopBar actor={actor} title="Moderation" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        <section>
          <h2 className="mb-1 font-semibold">Queue ({queue.length})</h2>
          <p className="mb-3 text-xs text-muted">Moderators decide on flags, not venues. Hidden content is never deleted, and every action is logged permanently.</p>
          {queue.length === 0 && <p className="rounded-2xl bg-panel p-6 text-center text-sm text-muted">All clear. Nothing flagged.</p>}
          <ul className="space-y-3">
            {queue.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`} className={`rounded-2xl border bg-panel p-3 ${item.content?.hiddenAt ? "border-packed/50" : "border-line"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 font-semibold uppercase">{item.targetType.toLowerCase()}</span>
                  {item.venue ? <Link href={`/v/${item.venue.slug}`} className="text-accent">{item.venue.name}</Link> : <span className="text-muted">Account report</span>}
                  {item.content?.hiddenAt && <span className="rounded bg-packed/20 px-1.5 py-0.5 font-semibold text-packed">{item.targetType === "USER" ? "Suspended" : "Hidden pending review"}</span>}
                </div>
                {item.content ? (
                  <div className="mt-2 flex gap-3">
                    {item.content.url && (
                      // eslint-disable-next-line @next/next/no-img-element -- moderators can view hidden photos
                      <img src={item.content.url} alt="Flagged photo" className="h-24 w-20 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 text-sm">
                      <p className="break-words">{item.content.preview || <span className="text-muted">(no caption)</span>}</p>
                      <p className="mt-1 text-xs text-muted">
                        by <Link href={`/u/${item.content.author}`} className="underline">@{item.content.author}</Link> (rep {item.content.authorRep.toFixed(2)}) · {formatAge(item.content.createdAt, now)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">Content not found.</p>
                )}
                <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
                  {item.flags.map((f) => (
                    <li key={f.id}>
                      <span className="text-warn">⚑</span> “{f.reason}” by @{f.by}
                      {f.byVenueOwner && <span className="ml-1 rounded bg-venue/20 px-1 text-[10px] font-bold uppercase text-venue">this venue&apos;s owner</span>}
                      {f.byOtherVenueOwner && <span className="ml-1 rounded bg-warn/20 px-1 text-[10px] font-bold uppercase text-warn">owner of another venue</span>}
                      <span className="text-muted"> · {formatAge(f.createdAt, now)}</span>
                    </li>
                  ))}
                </ul>
                {item.history.length > item.flags.length && (
                  <details className="mt-1 text-[11px] text-muted">
                    <summary className="cursor-pointer">History</summary>
                    <ul>
                      {item.history.map((h, i) => (
                        <li key={i}>{h.action} by {h.by} · {formatAge(h.at, now)}{h.note ? ` · ${h.note}` : ""}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {item.content && (
                  <div className="mt-2">
                    <ModActions targetType={item.targetType} targetId={item.targetId} hidden={Boolean(item.content.hiddenAt)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Moderation log</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel text-xs">
            {log.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 px-3 py-2">
                <span>
                  <b>{e.action}</b> {e.targetType.toLowerCase()} <code className="text-muted">{e.targetId.slice(-6)}</code> by {e.actor ? `@${e.actor.handle}` : "system"}
                  {e.note && <span className="text-muted"> · {e.note}</span>}
                </span>
                <span className="shrink-0 text-muted">{formatAge(e.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
