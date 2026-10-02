import Link from "next/link";
import { authorLabel } from "@/lib/author-label";
import type { LineWait, Vibe } from "@prisma/client";
import { formatCents } from "@/lib/money";
import { formatAge } from "@/lib/time";
import { LINE_META, VIBE_META } from "@/lib/vibe-ui";
import type { Consensus } from "@/lib/consensus";
import type { VenuePage } from "@/server/services/venues";
import { ReportPanel } from "./ReportPanel";
import { PresenceRsvp } from "./PresenceRsvp";
import { AutoRefresh, ExpiresAt } from "@/components/AutoRefresh";
import { LIVE_PHOTO_MS } from "@/lib/live-window";
import { CommentForm, CommentBody } from "./Comments";
import { FlagButton } from "@/components/mod/FlagButton";

/** User-controlled live reality. Venues cannot edit, hide or reorder anything here. */
export function LivePanel({ page, signedIn }: { page: VenuePage; signedIn: boolean }) {
  const { live, official, now, viewer } = page;
  const c = live.consensus;
  return (
    <section className="overflow-hidden rounded-3xl border border-accent/40 bg-panel" aria-labelledby="live-h">
      <AutoRefresh />
      <header className="flex items-center justify-between border-b border-accent/30 bg-accent/10 px-4 py-2.5">
        <h3 id="live-h" className="text-sm font-semibold uppercase tracking-wider text-accent">Live · from people here</h3>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-packed" /> last 3 hours
        </span>
      </header>

      <PresenceRsvp venueId={official.id} signedIn={signedIn} isOwner={viewer.ownsVenue} initialGoing={viewer.going} initialHere={viewer.hereNow} />
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <Stat n={live.hereNow} label="here now" />
        <Stat n={live.goingTonight} label="going tonight" />
        <Stat n={live.friendsGoing.length} label="friends going" accent />
      </div>
      {live.friendsGoing.length > 0 && (
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          👥{" "}
          {live.friendsGoing.slice(0, 4).map((f, i) => (
            <span key={f.handle}>
              {i > 0 && ", "}
              <Link href={`/u/${f.handle}`} className="text-accent">@{f.handle}</Link>
            </span>
          ))}
          {live.friendsGoing.length > 4 && ` +${live.friendsGoing.length - 4} more`} going tonight
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 p-3">
        <ConsensusCard title="Vibe" c={c.vibe} now={now} render={(v: Vibe) => (
          <span style={{ color: VIBE_META[v].text }}>{VIBE_META[v].emoji} {VIBE_META[v].label}</span>
        )} />
        <ConsensusCard title="Line" c={c.line} now={now} render={(v: LineWait) => LINE_META[v].label} />
        <ConsensusCard title="Cover" c={c.cover} now={now} render={(v: number) => formatCents(v)} />
      </div>

      {live.coverMismatch && c.cover.status === "ok" && (
        <div role="note" className="mx-3 mb-3 rounded-2xl border border-warn/50 bg-warn/10 px-3 py-2.5 text-sm">
          <div className="font-semibold text-warn">Cover mismatch</div>
          <div className="mt-0.5">
            <span className="text-venue">Venue says {formatCents(official.officialCoverCents)}</span>
            <span className="text-muted"> · </span>
            <span className="text-accent">Users say {formatCents(c.cover.value)}</span>
            <span className="text-muted"> · {c.cover.reportCount} report{c.cover.reportCount === 1 ? "" : "s"}, {formatAge(c.cover.newestAt, now)}</span>
          </div>
        </div>
      )}

      <ReportPanel
        venue={{ id: official.id, lat: official.lat, lng: official.lng, name: official.name }}
        signedIn={signedIn}
        isOwner={viewer.ownsVenue}
      />

      <div className="border-t border-line p-3">
        <h4 className="mb-2 text-sm font-semibold">Live photos</h4>
        {live.livePhotos.length === 0 ? (
          <p className="rounded-xl bg-panel-2 px-3 py-4 text-center text-sm text-muted">No photos in the last 3 hours.</p>
        ) : (
          <PhotoGrid photos={live.livePhotos} now={now} live signedIn={signedIn} />
        )}
        {live.earlierPhotos.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">Earlier ({live.earlierPhotos.length}) · not live</summary>
            <div className="mt-2 opacity-70">
              <PhotoGrid photos={live.earlierPhotos} now={now} signedIn={signedIn} />
            </div>
          </details>
        )}
      </div>

      <div className="border-t border-line p-3">
        <h4 className="mb-2 text-sm font-semibold">Comments</h4>
        {signedIn && !viewer.ownsVenue && <CommentForm venueId={official.id} />}
        {live.comments.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">No comments yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {live.comments.map((cm) => (
              <li key={cm.id} className="rounded-2xl bg-panel-2 p-3">
                <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                  {cm.author.kind === "user" ? <Link href={`/u/${cm.author.handle}`} className="font-medium text-text">{authorLabel(cm.author)}</Link> : <span className="font-medium text-muted">{authorLabel(cm.author)}</span>}
                  <span>{formatAge(cm.createdAt, now)}{cm.editedAt && " · edited"}</span>
                </div>
                <CommentBody id={cm.id} body={cm.body} canEdit={cm.mine} />
                {signedIn && !cm.mine && <FlagButton targetType="COMMENT" targetId={cm.id} className="mt-1" />}
                {cm.replies.map((r) => (
                  <div key={r.id} className="ml-3 mt-2 border-l-2 border-venue/60 pl-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-venue/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-venue">Venue reply</span>
                      <span className="text-muted">{official.name} · {formatAge(r.createdAt, now)}</span>
                    </div>
                    <CommentBody id={r.id} body={r.body} canEdit={r.mine} />
                    {signedIn && !r.mine && <FlagButton targetType="COMMENT" targetId={r.id} label="Flag reply" className="mt-1" />}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="px-2 py-3">
      <div className={`text-2xl font-bold ${accent ? "text-accent" : ""}`}>{n}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function ConsensusCard<T>({ title, c, now, render }: { title: string; c: Consensus<T>; now: Date; render: (v: T) => React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel-2 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted">{title}</div>
      {c.status === "ok" ? (
        <>
          <div className="mt-0.5 font-semibold leading-tight">{render(c.value)}</div>
          <div className="mt-1 text-[10px] leading-tight text-muted">
            {c.reportCount} report{c.reportCount === 1 ? "" : "s"} · {formatAge(c.newestAt, now)}
          </div>
        </>
      ) : (
        <>
          <div className="mt-0.5 text-sm font-medium text-muted">Not enough data</div>
          <div className="mt-1 text-[10px] leading-tight text-muted">
            {c.reportCount ? `${c.reportCount} report${c.reportCount === 1 ? "" : "s"}${c.newestAt ? ` · ${formatAge(c.newestAt, now)}` : ""}` : "No reports yet"}
          </div>
        </>
      )}
    </div>
  );
}

type PhotoItem = VenuePage["live"]["livePhotos"][number];
function PhotoGrid({ photos, now, live, signedIn }: { photos: PhotoItem[]; now: Date; live?: boolean; signedIn: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((p) => {
        const item = (
        <li key={p.id} className="overflow-hidden rounded-xl bg-panel-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own upload route */}
          <img src={p.url} alt={p.caption || (p.author.kind === "user" ? `Photo by @${p.author.handle}` : "Photo")} className="aspect-[4/5] w-full object-cover" loading="lazy" />
          <div className="px-2 py-1.5 text-[11px]">
            {p.caption && <div className="truncate">{p.caption}</div>}
            <div className="text-muted">{authorLabel(p.author)} · {formatAge(p.createdAt, now)}</div>
            {signedIn && !p.mine && <FlagButton targetType="PHOTO" targetId={p.id} />}
          </div>
        </li>
        );
        return live ? (
          <ExpiresAt key={p.id} at={new Date(p.createdAt.getTime() + LIVE_PHOTO_MS).toISOString()}>
            {item}
          </ExpiresAt>
        ) : (
          item
        );
      })}
    </ul>
  );
}
