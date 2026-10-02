import Link from "next/link";
import { authorLabel } from "@/lib/author-label";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatAge } from "@/lib/time";
import { LINE_META, VIBE_META } from "@/lib/vibe-ui";
import { TopBar } from "@/components/TopBar";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OfficialInfoForm, OfficialPhotoForm, PromoForm, EndPromoButton, ReplyBox } from "@/components/owner/OwnerForms";
import { FlagButton } from "@/components/mod/FlagButton";
import { getCurrentActor } from "@/server/current";
import { ServiceError } from "@/server/errors";
import { ownerVenueDashboard } from "@/server/services/owner";
import type { HoursEntry } from "@/lib/hours";

export const dynamic = "force-dynamic";

export default async function OwnerVenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/owner");
  let d;
  try {
    d = await ownerVenueDashboard(prisma, actor, (await params).venueId);
  } catch (e) {
    if (e instanceof ServiceError && (e.status === 403 || e.status === 404)) notFound();
    throw e;
  }
  const { venue, page, promos, coverHistory, accuracy, recentReports, hiddenReplies } = d;
  const c = page.live.consensus;
  const now = page.now;
  return (
    <>
      <TopBar actor={actor} title={`${venue.name} · Dashboard`} back="/owner" />
      <AutoRefresh />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{venue.name}</h2>
          <Link href={`/v/${venue.slug}`} className="text-sm text-accent">Public page →</Link>
        </div>

        <section className="rounded-3xl border border-accent/40 bg-panel p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Live right now (read-only)</h3>
          <p className="mt-1 text-xs text-muted">This is what people report. You can&apos;t edit, hide or reorder it; if something is false or abusive, flag it for a moderator.</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
            <Stat label="Here now" value={page.live.hereNow} />
            <Stat label="Going" value={page.live.goingTonight} />
            <Stat label="Vibe" value={c.vibe.status === "ok" ? VIBE_META[c.vibe.value].label : "—"} />
            <Stat label="Line" value={c.line.status === "ok" ? LINE_META[c.line.value].short : "—"} />
            <Stat label="Users' cover" value={c.cover.status === "ok" ? formatCents(c.cover.value) : "—"} />
            <Stat label="Accuracy" value={accuracy.status === "ok" ? `${accuracy.scorePct}%` : accuracy.status === "no_official_cover" ? "No cover posted" : "n/a"} />
          </dl>
          {page.live.coverMismatch && c.cover.status === "ok" && (
            <p className="mt-3 rounded-xl border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
              People are reporting <b>{formatCents(c.cover.value)}</b> but your official cover is <b>{formatCents(venue.officialCoverCents)}</b>.
              Update it below if it changed. Your accuracy score is computed from these reports and can&apos;t be edited.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-venue/40 bg-panel p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-venue">Official info</h3>
          <OfficialInfoForm
            venueId={venue.id}
            initial={{
              name: venue.name,
              address: venue.address,
              officialCover: venue.officialCoverCents === null ? "" : venue.officialCoverCents === 0 ? "free" : String(venue.officialCoverCents / 100),
              dressCode: venue.dressCode ?? "",
              hours: (venue.hours as HoursEntry[]) ?? [],
            }}
          />
          {coverHistory.length > 1 && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer">Official cover history (append-only)</summary>
              <ul className="mt-1 space-y-0.5">
                {coverHistory.map((h) => (
                  <li key={h.id}>{h.effectiveFrom.toLocaleString("en-US", { timeZone: "America/New_York" })}: {h.coverCents === null ? "not stated" : formatCents(h.coverCents)}</li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="rounded-3xl border border-venue/40 bg-panel p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-venue">Official photo</h3>
          <OfficialPhotoForm venueId={venue.id} currentUrl={venue.officialPhotoUrl} />
        </section>

        <section className="rounded-3xl border border-venue/40 bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-venue">Promos</h3>
          <p className="mb-3 text-xs text-muted">Paid promos are marked by an admin and always labelled &quot;Promoted&quot;. Paying never changes how people&apos;s reports, photos or comments are ranked or shown.</p>
          <PromoForm venueId={venue.id} />
          <ul className="mt-3 space-y-2">
            {promos.map((p) => {
              const active = p.startsAt <= now && p.endsAt > now;
              return (
                <li key={p.id} className="flex items-start justify-between gap-2 rounded-xl bg-panel-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {p.title}{" "}
                      {p.isPaid && <span className="ml-1 rounded bg-warn px-1 text-[10px] font-bold uppercase text-ink">Promoted</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {active ? "Active" : p.endsAt <= now ? "Ended" : "Scheduled"} · {p.startsAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" })} to{" "}
                      {p.endsAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" })} ET
                    </div>
                  </div>
                  {p.endsAt > now && <EndPromoButton promoId={p.id} />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">Live photos &amp; reports</h3>
          <p className="mb-3 text-xs text-muted">Think something is false or abusive? Flag it. A moderator decides; flagging doesn&apos;t hide anything.</p>
          {page.live.livePhotos.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2">
              {page.live.livePhotos.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-xl bg-panel-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own upload route */}
                  <img src={p.url} alt={p.caption || "Live photo"} className="aspect-square w-full object-cover" />
                  <div className="px-1.5 py-1 text-[10px] text-muted">{authorLabel(p.author)}</div>
                  <div className="px-1.5 pb-1.5"><FlagButton targetType="PHOTO" targetId={p.id} /></div>
                </li>
              ))}
            </ul>
          )}
          {recentReports.length === 0 ? (
            <p className="text-sm text-muted">No reports in the last 3 hours.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentReports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5">
                  <span>
                    <span className="text-muted">{r.type.toLowerCase()}:</span>{" "}
                    {r.type === "VIBE" ? VIBE_META[r.vibe!].label : r.type === "LINE" ? LINE_META[r.line!].label : formatCents(r.coverCents)}
                    <span className="text-xs text-muted"> · {formatAge(r.createdAt, now)}</span>
                  </span>
                  <FlagButton targetType="REPORT" targetId={r.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-line bg-panel p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Comments</h3>
          {page.live.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
          {hiddenReplies.length > 0 && (
            <div className="mb-3 rounded-xl border border-packed/40 bg-packed/5 p-2.5 text-xs">
              <div className="font-semibold text-packed">Replies hidden by a moderator ({hiddenReplies.length})</div>
              <ul className="mt-1 space-y-0.5 text-muted">
                {hiddenReplies.map((r) => <li key={r.id} className="truncate">“{r.body}”</li>)}
              </ul>
            </div>
          )}
          <ul className="space-y-3">
            {page.live.comments.map((cm) => (
              <li key={cm.id} className="rounded-2xl bg-panel-2 p-3 text-sm">
                <div className="flex justify-between text-xs text-muted">
                  <span>{authorLabel(cm.author)}</span>
                  <span>{formatAge(cm.createdAt, now)}</span>
                </div>
                <p className="mt-1">{cm.body}</p>
                {cm.replies.map((r) => (
                  <p key={r.id} className="ml-3 mt-2 border-l-2 border-venue/60 pl-2 text-sm">
                    <span className="mr-1 rounded bg-venue/20 px-1 text-[10px] font-bold uppercase text-venue">
                      {r.mine ? "Your reply" : `Venue reply · ${authorLabel(r.author)}`}
                    </span>
                    {r.body}
                  </p>
                ))}
                <div className="mt-2 flex flex-wrap items-center gap-2" data-slot="comment-actions">
                  <ReplyBox commentId={cm.id} />
                  <FlagButton targetType="COMMENT" targetId={cm.id} label="Flag for moderator" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-panel-2 px-1 py-2">
      <dd className="font-semibold">{value}</dd>
      <dt className="text-[10px] text-muted">{label}</dt>
    </div>
  );
}
